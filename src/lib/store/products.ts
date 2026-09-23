import "server-only";

import { unstable_cache } from "next/cache";

import { tagFor } from "@/lib/cache-tags";
import { applyPromotions, type PriceResult, type Promotion } from "@/lib/pricing";
import { slugify } from "@/lib/slug";
import type { Json } from "@/lib/supabase/database.types";
import { createClient, createPublicClient } from "@/lib/supabase/server";

import type { FreshVariant } from "./cart-validation";
import { descendantIds, listCategories } from "./categories";
import { searchScore, searchText, searchTokens, matchesTokens } from "./search";
import { asArray, asObject, asString, CACHE_REVALIDATE } from "./utils";

/*
 * Lecturas de productos del storefront.
 *
 * Estrategia: un ÍNDICE liviano cacheado de todo el catálogo activo (id,
 * nombre, precios, categorías, stock, opciones de cada variante…) para
 * filtrar, facetar, ordenar y paginar en memoria sin límites de PostgREST.
 * Después se piden los datos de las cards sólo para los ids de la página.
 * Escala bien hasta unos miles de productos.
 *
 * Facetas (P0-10): se calculan sobre las `option_values` de las variantes
 * activas que trae el índice (una sola query cacheada con tag `products`),
 * en vez de consultar la DB por cada combinación de filtros. El índice GIN
 * de `product_variants.option_values` queda para consultas SQL directas.
 *
 * Multi-tienda: toda función que consulta recibe `storeId` primero y filtra
 * `.eq("store_id", storeId)`; las keys de `unstable_cache` llevan el
 * `storeId` y las tags son `tagFor(base, storeId[, slug])`.
 *
 * IMPORTANTE (RLS/grants): `anon` NO puede leer `product_variants.cost`, así
 * que las queries públicas listan columnas explícitas (nunca `*`).
 */

const VARIANT_COLUMNS =
  "id, title, option_values, sku, price, compare_at_price, stock, track_inventory, allow_backorder, low_stock_threshold, image_id, position, is_active";

export interface StoreVariant {
  id: string;
  title: string;
  optionValues: Record<string, string>;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  lowStockThreshold: number | null;
  imageId: string | null;
  position: number;
  /** Se puede comprar (hay stock, no controla stock o permite backorder). */
  available: boolean;
}

export interface StoreImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface ProductOption {
  name: string;
  values: string[];
}

/** Datos para una card de producto. */
export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  sku: string | null;
  image: StoreImage | null;
  secondImage: StoreImage | null;
  categoryIds: string[];
  variants: StoreVariant[];
  /** Hay precios distintos entre variantes ("Desde"). */
  priceVaries: boolean;
  available: boolean;
  featured: boolean;
  tags: string[];
  createdAt: string;
  /** Alícuota propia (null = default de la tienda). */
  vatPercent: number | null;
  /** Tiene opciones (Talle, Color…) → la compra rápida lleva a la ficha. */
  hasOptions: boolean;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductDetail extends ProductCardData {
  descriptionHtml: string | null;
  shortDescription: string | null;
  images: StoreImage[];
  options: ProductOption[];
  seo: { title: string; description: string; og_image_url: string };
  categories: { id: string; name: string; slug: string; parentId: string | null }[];
  specs: ProductSpec[];
  relatedIds: string[];
  status: "draft" | "active" | "archived";
  updatedAt: string;
}

/** Variante compacta del índice (para facetas por opción). */
export interface IndexVariant {
  /** option_values */
  o: Record<string, string>;
  /** disponible */
  a: boolean;
  /** precio de lista */
  p: number;
}

export interface CatalogIndexItem {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  /** Texto normalizado para búsqueda (nombre, marca, SKUs, tags). */
  search: string;
  skus: string[];
  categoryIds: string[];
  minPrice: number;
  maxPrice: number;
  hasCompareAt: boolean;
  available: boolean;
  featured: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  image: string | null;
  variants: IndexVariant[];
}

// ---------------------------------------------------------------------------
// Mapeos
// ---------------------------------------------------------------------------

interface VariantRow {
  id: string;
  title: string;
  option_values: Json;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  low_stock_threshold: number | null;
  image_id: string | null;
  position: number;
  is_active: boolean;
}

function optionRecord(value: Json): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(asObject(value))) {
    if (typeof val === "string" && val.trim()) out[k] = val;
  }
  return out;
}

function isAvailable(v: { track_inventory: boolean; allow_backorder: boolean; stock: number }): boolean {
  return !v.track_inventory || v.allow_backorder || v.stock > 0;
}

function toVariant(v: VariantRow): StoreVariant {
  return {
    id: v.id,
    title: v.title,
    optionValues: optionRecord(v.option_values),
    sku: v.sku,
    price: Number(v.price),
    compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
    stock: v.stock,
    trackInventory: v.track_inventory,
    allowBackorder: v.allow_backorder,
    lowStockThreshold: v.low_stock_threshold,
    imageId: v.image_id,
    position: v.position,
    available: isAvailable(v),
  };
}

function toImage(i: { id: string; url: string; alt: string | null; position: number }): StoreImage {
  return { id: i.id, url: i.url, alt: i.alt, position: i.position };
}

function parseOptions(value: Json): ProductOption[] {
  return asArray(value)
    .map((raw) => {
      const o = asObject(raw);
      return {
        name: asString(o.name),
        values: asArray(o.values).filter((x): x is string => typeof x === "string"),
      };
    })
    .filter((o) => o.name && o.values.length);
}

function parseSpecs(value: Json): ProductSpec[] {
  return asArray(value)
    .map((raw) => {
      const o = asObject(raw);
      return { label: asString(o.label).trim(), value: asString(o.value).trim() };
    })
    .filter((s) => s.label && s.value);
}

interface CardRow {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  featured: boolean;
  tags: string[];
  created_at: string;
  vat_percent: number | null;
  options: Json;
  product_images: { id: string; url: string; alt: string | null; position: number }[];
  product_variants: VariantRow[];
  product_categories: { category_id: string }[];
}

function toCard(row: CardRow): ProductCardData {
  const variants = row.product_variants
    .filter((v) => v.is_active)
    .sort((a, b) => a.position - b.position)
    .map(toVariant);
  const images = [...row.product_images].sort((a, b) => a.position - b.position).map(toImage);
  const prices = variants.map((v) => v.price);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    sku: variants[0]?.sku ?? null,
    image: images[0] ?? null,
    secondImage: images[1] ?? null,
    categoryIds: row.product_categories.map((c) => c.category_id),
    variants,
    priceVaries: prices.length > 1 && Math.min(...prices) !== Math.max(...prices),
    available: variants.some((v) => v.available),
    featured: row.featured,
    tags: row.tags,
    createdAt: row.created_at,
    vatPercent: row.vat_percent === null ? null : Number(row.vat_percent),
    hasOptions: variants.length > 1 || parseOptions(row.options).length > 0,
  };
}

const CARD_SELECT = `id, slug, name, brand, featured, tags, created_at, vat_percent, options,
  product_images(id, url, alt, position),
  product_variants(${VARIANT_COLUMNS}),
  product_categories(category_id)`;

const DETAIL_SELECT = `${CARD_SELECT}, status, updated_at, description_html, short_description, seo, specs, related_ids,
  categories(id, name, slug, parent_id)`;

// ---------------------------------------------------------------------------
// Índice del catálogo
// ---------------------------------------------------------------------------

/** Índice liviano de TODOS los productos activos de la tienda. Tag: `products:<storeId>`. */
async function fetchCatalogIndex(storeId: string): Promise<CatalogIndexItem[]> {
  const supabase = createPublicClient();
  const out: CatalogIndexItem[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, slug, name, brand, featured, tags, created_at, updated_at, product_images(url, position), product_variants(sku, price, compare_at_price, stock, track_inventory, allow_backorder, is_active, option_values), product_categories(category_id)",
      )
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);
    for (const p of data ?? []) {
      const variants = p.product_variants.filter((v) => v.is_active);
      if (!variants.length) continue;
      const prices = variants.map((v) => Number(v.price));
      const skus = variants.map((v) => v.sku ?? "").filter(Boolean);
      const firstImage = [...p.product_images].sort((a, b) => a.position - b.position)[0];
      out.push({
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        search: searchText({ name: p.name, brand: p.brand, skus, tags: p.tags }),
        skus,
        categoryIds: p.product_categories.map((c) => c.category_id),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        hasCompareAt: variants.some((v) => v.compare_at_price != null && Number(v.compare_at_price) > Number(v.price)),
        available: variants.some(isAvailable),
        featured: p.featured,
        tags: p.tags,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        image: firstImage?.url ?? null,
        variants: variants.map((v) => ({ o: optionRecord(v.option_values), a: isAvailable(v), p: Number(v.price) })),
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export function getCatalogIndex(storeId: string): Promise<CatalogIndexItem[]> {
  return unstable_cache(() => fetchCatalogIndex(storeId), ["store-catalog-index-v2", storeId], {
    tags: [tagFor("products", storeId)],
    revalidate: CACHE_REVALIDATE,
  })();
}

/** Cards para una lista de ids (respeta el orden pedido). Tag: `products:<storeId>`. */
export function getProductCards(storeId: string, ids: string[]): Promise<ProductCardData[]> {
  if (!ids.length) return Promise.resolve([]);
  return unstable_cache(
    async (): Promise<ProductCardData[]> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase.from("products").select(CARD_SELECT).eq("store_id", storeId).in("id", ids).eq("status", "active");
      if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
      const byId = new Map((data ?? []).map((row) => [row.id, toCard(row as CardRow)]));
      return ids.map((id) => byId.get(id)).filter((p): p is ProductCardData => !!p && p.variants.length > 0);
    },
    ["store-product-cards-v2", storeId, ids.join(",")],
    { tags: [tagFor("products", storeId)], revalidate: CACHE_REVALIDATE },
  )();
}

// ---------------------------------------------------------------------------
// Listado con filtros y facetas
// ---------------------------------------------------------------------------

export type ProductSort = "relevancia" | "nuevos" | "precio-asc" | "precio-desc" | "nombre" | "destacados";
export type OutOfStockDisplay = "show" | "show_last" | "hide";

export interface ProductFilters {
  q?: string;
  /** Slug de categoría (incluye subcategorías). */
  category?: string;
  categoryId?: string;
  tag?: string;
  featured?: boolean;
  onSale?: boolean;
  /** Productos con promo activa (necesita `promotions`). */
  promotions?: Promotion[];
  minPrice?: number;
  maxPrice?: number;
  /** Opción → valores aceptados (OR dentro de la opción, AND entre opciones, sobre la MISMA variante). */
  options?: Record<string, string[]>;
  brands?: string[];
  /** Sólo con stock (y, con opciones, sólo variantes con stock). */
  inStock?: boolean;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
  ids?: string[];
  /** Mostrar primero los que tienen stock (default true). Lo pisa `outOfStock`. */
  availableFirst?: boolean;
  /** `catalog.out_of_stock_display` de la tienda. */
  outOfStock?: OutOfStockDisplay;
}

export interface ProductList {
  items: ProductCardData[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

export interface OptionFacet {
  name: string;
  /** Nombre del query param (`talle`, `color`…). */
  param: string;
  values: FacetValue[];
}

export interface CatalogFacets {
  options: OptionFacet[];
  brands: FacetValue[];
  /** Rango de precios de lista del conjunto (sin el filtro de precio). */
  price: { min: number; max: number } | null;
  /** Cantidad por categoría (incluye descendientes) sin el filtro de categoría. */
  categoryCounts: Record<string, number>;
  /** Cuántos quedan con "Sólo con stock". */
  inStockCount: number;
}

/** Query params reservados: una opción que se llame igual usa el prefijo `op-`. */
const RESERVED_PARAMS = new Set(["q", "orden", "pagina", "page", "por", "marca", "precio_min", "precio_max", "stock", "cat", "variant", "preview"]);

/** Nombre de opción → query param ("Talle" → "talle"). */
export function optionParam(name: string): string {
  const slug = slugify(name, 40) || "opcion";
  return RESERVED_PARAMS.has(slug) ? `op-${slug}` : slug;
}

function variantMatches(v: IndexVariant, options: [string, string[]][], inStock: boolean): boolean {
  if (inStock && !v.a) return false;
  return options.every(([name, values]) => v.o[name] !== undefined && values.includes(v.o[name]));
}

interface Predicates {
  tokens: string[];
  categoryIds: Set<string> | null;
  options: [string, string[]][];
  brands: Set<string> | null;
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
}

type FacetKey = "category" | "brand" | "price" | "stock" | `option:${string}`;

function passes(p: CatalogIndexItem, pr: Predicates, skip?: FacetKey): boolean {
  if (pr.tokens.length && !matchesTokens(p.search, pr.tokens)) return false;
  if (skip !== "category" && pr.categoryIds && !p.categoryIds.some((c) => pr.categoryIds!.has(c))) return false;
  if (skip !== "brand" && pr.brands && !(p.brand && pr.brands.has(p.brand))) return false;
  if (skip !== "price") {
    if (pr.minPrice != null && p.maxPrice < pr.minPrice) return false;
    if (pr.maxPrice != null && p.minPrice > pr.maxPrice) return false;
  }
  const inStock = skip === "stock" ? false : pr.inStock;
  const options = skip?.startsWith("option:") ? pr.options.filter(([n]) => `option:${n}` !== skip) : pr.options;
  if (options.length || inStock) {
    if (!p.variants.some((v) => variantMatches(v, options, inStock))) return false;
  }
  return true;
}

async function buildPredicates(storeId: string, filters: ProductFilters): Promise<Predicates | null> {
  let categoryIds: Set<string> | null = null;
  if (filters.category || filters.categoryId) {
    const categories = await listCategories(storeId);
    const root = filters.categoryId ?? categories.find((c) => c.slug === filters.category)?.id;
    if (!root) return null;
    categoryIds = new Set(descendantIds(categories, root));
  }
  const options = Object.entries(filters.options ?? {}).filter(([, values]) => values.length > 0);
  return {
    tokens: filters.q ? searchTokens(filters.q) : [],
    categoryIds,
    options,
    brands: filters.brands?.length ? new Set(filters.brands) : null,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: Boolean(filters.inStock),
  };
}

function sortItems(items: CatalogIndexItem[], filters: ProductFilters, tokens: string[]): CatalogIndexItem[] {
  const sorted = [...items];
  const sort = filters.sort ?? (tokens.length ? "relevancia" : "nuevos");
  switch (sort) {
    case "relevancia": {
      if (tokens.length) {
        const score = new Map(sorted.map((p) => [p.id, searchScore({ name: p.name, brand: p.brand, skus: p.skus, tags: p.tags }, tokens)]));
        sorted.sort((a, b) => score.get(b.id)! - score.get(a.id)!);
      }
      break;
    }
    case "precio-asc":
      sorted.sort((a, b) => a.minPrice - b.minPrice);
      break;
    case "precio-desc":
      sorted.sort((a, b) => b.minPrice - a.minPrice);
      break;
    case "nombre":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
      break;
    case "destacados":
      sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
      break;
    default:
      break; // el índice ya viene por created_at desc
  }
  const mode = filters.outOfStock ?? (filters.availableFirst === false ? "show" : "show_last");
  // Agotados al final (orden estable) salvo que la tienda elija mezclarlos.
  if (mode === "show_last") sorted.sort((a, b) => Number(b.available) - Number(a.available));
  return sorted;
}

function filterBase(items: CatalogIndexItem[], filters: ProductFilters): CatalogIndexItem[] {
  let out = items;
  if (filters.ids) {
    const order = new Map(filters.ids.map((id, i) => [id, i]));
    out = out.filter((p) => order.has(p.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }
  if (filters.outOfStock === "hide") out = out.filter((p) => p.available);
  if (filters.tag) out = out.filter((p) => p.tags.includes(filters.tag!));
  if (filters.featured) out = out.filter((p) => p.featured);
  if (filters.onSale) {
    const promos = filters.promotions ?? [];
    // "Ofertas": precio tachado, promo por unidad o promo por cantidad (3x2, 2.ª al 50 %).
    out = out.filter((p) => {
      if (p.hasCompareAt) return true;
      const priced = applyPromotions({ id: p.id, price: p.minPrice }, { id: p.id, categoryIds: p.categoryIds }, promos);
      return Boolean(priced.promotion || priced.offer);
    });
  }
  return out;
}

function paginate(items: CatalogIndexItem[], filters: ProductFilters) {
  const perPage = Math.min(Math.max(filters.perPage ?? 24, 1), 96);
  const pageCount = Math.ceil(items.length / perPage);
  const page = Math.min(Math.max(filters.page ?? 1, 1), Math.max(pageCount, 1));
  return { perPage, page, pageCount, slice: items.slice((page - 1) * perPage, page * perPage) };
}

/** Listado paginado para `/productos`, categorías y bloques. */
export async function listProducts(storeId: string, filters: ProductFilters = {}): Promise<ProductList> {
  const perPage = Math.min(Math.max(filters.perPage ?? 24, 1), 96);
  const predicates = await buildPredicates(storeId, filters);
  if (!predicates) return { items: [], total: 0, page: 1, perPage, pageCount: 0 };
  const base = filterBase(await getCatalogIndex(storeId), filters);
  const matched = base.filter((p) => passes(p, predicates));
  const sorted = filters.ids ? matched : sortItems(matched, filters, predicates.tokens);
  const { page, pageCount, slice } = paginate(sorted, filters);
  return { items: await getProductCards(storeId, slice.map((p) => p.id)), total: sorted.length, page, perPage, pageCount };
}

function facetValues(counts: Map<string, number>, selected: Set<string>): FacetValue[] {
  // Los seleccionados se muestran aunque tengan 0 (para poder sacarlos).
  for (const s of selected) if (!counts.has(s)) counts.set(s, 0);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, selected: selected.has(value) }))
    .sort((a, b) => a.value.localeCompare(b.value, "es", { numeric: true }));
}

/** Orden natural de talles de ropa (XS < S < M < L < XL…); el resto alfabético/numérico. */
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL"];
function sortOptionValues(values: FacetValue[]): FacetValue[] {
  const rank = (v: string) => SIZE_ORDER.indexOf(v.toUpperCase());
  if (values.every((v) => rank(v.value) >= 0)) return [...values].sort((a, b) => rank(a.value) - rank(b.value));
  return values;
}

/**
 * Listado + facetas (P0-10). Cada faceta se cuenta con TODOS los filtros
 * menos el suyo (facetas "disjuntivas"), así se puede sumar un segundo talle.
 */
export async function searchCatalog(
  storeId: string,
  filters: ProductFilters,
): Promise<{ list: ProductList; facets: CatalogFacets }> {
  const perPage = Math.min(Math.max(filters.perPage ?? 24, 1), 96);
  const empty: CatalogFacets = { options: [], brands: [], price: null, categoryCounts: {}, inStockCount: 0 };
  const predicates = await buildPredicates(storeId, filters);
  if (!predicates) return { list: { items: [], total: 0, page: 1, perPage, pageCount: 0 }, facets: empty };

  const base = filterBase(await getCatalogIndex(storeId), filters);
  const matched = base.filter((p) => passes(p, predicates));
  const sorted = sortItems(matched, filters, predicates.tokens);
  const { page, pageCount, slice } = paginate(sorted, filters);

  // --- Opciones: nombres presentes en el conjunto sin filtros de opción.
  const optionNames = new Set<string>();
  for (const p of base) {
    if (!passes(p, { ...predicates, options: [] })) continue;
    for (const v of p.variants) for (const k of Object.keys(v.o)) optionNames.add(k);
  }
  const options: OptionFacet[] = [];
  for (const name of [...optionNames].sort((a, b) => a.localeCompare(b, "es"))) {
    const counts = new Map<string, number>();
    const others = predicates.options.filter(([n]) => n !== name);
    for (const p of base) {
      if (!passes(p, predicates, `option:${name}`)) continue;
      const values = new Set<string>();
      for (const v of p.variants) {
        if (v.o[name] !== undefined && variantMatches(v, others, predicates.inStock)) values.add(v.o[name]);
      }
      for (const val of values) counts.set(val, (counts.get(val) ?? 0) + 1);
    }
    const selected = new Set(predicates.options.find(([n]) => n === name)?.[1] ?? []);
    const values = sortOptionValues(facetValues(counts, selected));
    if (values.length > 1 || selected.size) options.push({ name, param: optionParam(name), values });
  }

  // --- Marcas
  const brandCounts = new Map<string, number>();
  for (const p of base) if (p.brand && passes(p, predicates, "brand")) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const brands = facetValues(brandCounts, predicates.brands ?? new Set());

  // --- Precio
  let min = Infinity;
  let max = -Infinity;
  for (const p of base) {
    if (!passes(p, predicates, "price")) continue;
    min = Math.min(min, p.minPrice);
    max = Math.max(max, p.maxPrice);
  }

  // --- Categorías (cada producto cuenta en su categoría; los padres suman en la vista)
  const categoryCounts: Record<string, number> = {};
  for (const p of base) {
    if (!passes(p, predicates, "category")) continue;
    for (const c of p.categoryIds) categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
  }

  const inStockCount = base.filter((p) => passes(p, { ...predicates, inStock: true }, undefined)).length;

  return {
    list: { items: await getProductCards(storeId, slice.map((p) => p.id)), total: sorted.length, page, perPage, pageCount },
    facets: {
      options,
      brands: brands.length > 1 || predicates.brands ? brands : [],
      price: Number.isFinite(min) ? { min, max } : null,
      categoryCounts,
      inStockCount,
    },
  };
}

/** Query param → nombre de opción ("talle" → "Talle"), sobre todo el catálogo activo. */
export async function getOptionParamMap(storeId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const p of await getCatalogIndex(storeId)) {
    for (const v of p.variants) for (const name of Object.keys(v.o)) if (!map.has(optionParam(name))) map.set(optionParam(name), name);
  }
  return map;
}

/** Sugerencias del buscador del header (máx. `limit`). */
export async function searchSuggestions(storeId: string, q: string, limit = 8, outOfStock: OutOfStockDisplay = "show_last") {
  const tokens = searchTokens(q);
  if (!tokens.length) return { items: [], total: 0 };
  let items = (await getCatalogIndex(storeId)).filter((p) => matchesTokens(p.search, tokens));
  if (outOfStock === "hide") items = items.filter((p) => p.available);
  const sorted = sortItems(items, { sort: "relevancia", outOfStock }, tokens);
  return {
    total: sorted.length,
    items: sorted.slice(0, limit).map((p) => ({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      sku: p.skus[0] ?? null,
      price: p.minPrice,
      priceVaries: p.minPrice !== p.maxPrice,
      image: p.image,
      available: p.available,
    })),
  };
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

interface DetailRow extends CardRow {
  status: string;
  updated_at: string;
  description_html: string | null;
  short_description: string | null;
  seo: Json;
  specs: Json;
  related_ids: string[];
  categories: { id: string; name: string; slug: string; parent_id: string | null }[];
}

function toDetail(data: DetailRow): ProductDetail | null {
  const card = toCard(data);
  if (!card.variants.length) return null;
  const seo = asObject(data.seo);
  return {
    ...card,
    descriptionHtml: data.description_html,
    shortDescription: data.short_description,
    images: [...data.product_images].sort((a, b) => a.position - b.position).map(toImage),
    options: parseOptions(data.options),
    seo: { title: asString(seo.title), description: asString(seo.description), og_image_url: asString(seo.og_image_url) },
    categories: data.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, parentId: c.parent_id })),
    specs: parseSpecs(data.specs),
    relatedIds: data.related_ids ?? [],
    status: (["draft", "active", "archived"].includes(data.status) ? data.status : "draft") as ProductDetail["status"],
    updatedAt: data.updated_at,
  };
}

/** Producto activo por slug (o `null`). Tags: `products:<storeId>`, `product:<storeId>:<slug>`. */
export function getProduct(storeId: string, slug: string): Promise<ProductDetail | null> {
  return unstable_cache(
    async (): Promise<ProductDetail | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("products")
        .select(DETAIL_SELECT)
        .eq("store_id", storeId)
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el producto ${slug}: ${error.message}`);
      return data ? toDetail(data as unknown as DetailRow) : null;
    },
    ["store-product-v2", storeId, slug],
    { tags: [tagFor("products", storeId), tagFor("product", storeId, slug)], revalidate: CACHE_REVALIDATE },
  )();
}

/**
 * Vista previa (P0-13): cualquier estado, SIN cache, con la sesión del
 * usuario (RLS deja leer todo a `is_store_admin(store_id)`). El que llama verifica que sea admin.
 */
export async function getProductPreview(storeId: string, slug: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_SELECT)
    .eq("store_id", storeId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error(`[preview] ${slug}: ${error.message}`);
    return null;
  }
  return data ? toDetail(data as unknown as DetailRow) : null;
}

/**
 * Relacionados (P0-12): primero los elegidos a mano (`related_ids`), después
 * automáticos: misma categoría, luego tags en común. Excluye el actual y los
 * agotados.
 */
export async function getRelated(
  storeId: string,
  product: Pick<ProductDetail, "id" | "categoryIds" | "tags" | "relatedIds">,
  limit = 8,
): Promise<ProductCardData[]> {
  const index = await getCatalogIndex(storeId);
  const byId = new Map(index.map((p) => [p.id, p]));
  const picked: string[] = [];
  const add = (id: string) => {
    if (picked.length >= limit || id === product.id || picked.includes(id)) return;
    const p = byId.get(id);
    if (p && p.available) picked.push(id);
  };
  for (const id of product.relatedIds) add(id);
  if (picked.length < limit && product.categoryIds.length) {
    const cats = new Set(product.categoryIds);
    for (const p of index) if (p.categoryIds.some((c) => cats.has(c))) add(p.id);
  }
  if (picked.length < limit && product.tags.length) {
    const tags = new Set(product.tags);
    for (const p of index) if (p.tags.some((t) => tags.has(t))) add(p.id);
  }
  return getProductCards(storeId, picked);
}

// ---------------------------------------------------------------------------
// Checkout: variantes frescas (SIN cache)
// ---------------------------------------------------------------------------

interface FreshRow {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  is_active: boolean;
  image_id: string | null;
  products: {
    id: string;
    slug: string;
    name: string;
    status: string;
    vat_percent: number | null;
    product_images: { id: string; url: string; position: number }[];
    product_categories: { category_id: string }[];
  } | null;
}

/** Estado actual de las variantes (precio, stock, activo) para validar el carrito y crear el pedido. */
export async function getFreshVariants(storeId: string, variantIds: string[]): Promise<Map<string, FreshVariant>> {
  const ids = [...new Set(variantIds)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  const out = new Map<string, FreshVariant>();
  if (!ids.length) return out;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, title, sku, price, compare_at_price, stock, track_inventory, allow_backorder, is_active, image_id, products(id, slug, name, status, vat_percent, product_images(id, url, position), product_categories(category_id))",
    )
    .eq("store_id", storeId)
    .in("id", ids);
  if (error) throw new Error(`No se pudieron leer las variantes: ${error.message}`);
  for (const row of (data ?? []) as unknown as FreshRow[]) {
    const p = row.products;
    if (!p) continue;
    const images = [...p.product_images].sort((a, b) => a.position - b.position);
    out.set(row.id, {
      variantId: row.id,
      productId: p.id,
      slug: p.slug,
      name: p.name,
      variantTitle: row.title === "Default" ? null : row.title,
      sku: row.sku,
      image: images.find((i) => i.id === row.image_id)?.url ?? images[0]?.url ?? null,
      price: Number(row.price),
      compareAtPrice: row.compare_at_price === null ? null : Number(row.compare_at_price),
      categoryIds: p.product_categories.map((c) => c.category_id),
      vatPercent: p.vat_percent === null ? null : Number(p.vat_percent),
      stock: row.stock,
      trackInventory: row.track_inventory,
      allowBackorder: row.allow_backorder,
      active: row.is_active && p.status === "active",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Precio para mostrar
// ---------------------------------------------------------------------------

export interface DisplayPrice extends PriceResult {
  /** "Desde": hay variantes con precios distintos. */
  from: boolean;
}

/** Precio a mostrar en una card: la variante disponible más barata, con promos. */
export function displayPrice(product: ProductCardData, promotions: Promotion[], now = new Date()): DisplayPrice {
  const pool = product.variants.filter((v) => v.available);
  const candidates = pool.length ? pool : product.variants;
  const cheapest = candidates.reduce((min, v) => (v.price < min.price ? v : min), candidates[0]);
  const result = applyPromotions(
    { id: cheapest.id, price: cheapest.price, compareAtPrice: cheapest.compareAtPrice },
    { id: product.id, categoryIds: product.categoryIds },
    promotions,
    now,
  );
  return { ...result, from: product.priceVaries };
}
