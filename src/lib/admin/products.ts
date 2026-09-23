import "server-only";

import { requireAdmin } from "@/lib/auth";
import { normalizePriceTiers, type PriceTier } from "@/lib/pricing";
import type { Json } from "@/lib/supabase/database.types";

import { catalogDb, type AdminProductRow } from "./catalog-db";
import { parseSpecsJson, type SpecRow } from "./specs";
import type { OptionInput, OptionValues } from "./variant-matrix";

/*
 * Lecturas de productos del admin (sin caché, bajo RLS del usuario).
 */

export const PRODUCTS_PER_PAGE = 50;

export type ProductSort = "actualizado" | "nombre" | "precio" | "precio-desc" | "stock" | "stock-desc" | "nuevos";
export type StockFilter = "con" | "sin" | "bajo";

export interface ProductListFilters {
  q: string;
  status: "active" | "draft" | "archived" | null;
  categoryId: string | null;
  stock: StockFilter | null;
  source: "manual" | "import" | "scrape" | null;
  sort: ProductSort;
  page: number;
}

const STATUS_PARAM: Record<string, ProductListFilters["status"]> = {
  activos: "active",
  borradores: "draft",
  archivados: "archived",
};

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

/** `?q=&estado=&categoria=&stock=&origen=&orden=&page=` → filtros tipados. */
export function parseProductFilters(params: Params): ProductListFilters {
  const stock = first(params.stock);
  const source = first(params.origen);
  const sort = first(params.orden);
  const categoryId = first(params.categoria);
  return {
    q: first(params.q).trim().slice(0, 100),
    status: STATUS_PARAM[first(params.estado)] ?? null,
    categoryId: isUuid(categoryId) ? categoryId : null,
    stock: stock === "con" || stock === "sin" || stock === "bajo" ? stock : null,
    source: source === "manual" || source === "import" || source === "scrape" ? source : null,
    sort: (["actualizado", "nombre", "precio", "precio-desc", "stock", "stock-desc", "nuevos"] as const).includes(sort as ProductSort)
      ? (sort as ProductSort)
      : "actualizado",
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(params.page), 10) || 1)),
  };
}

/** Texto seguro para un filtro `or=(…)` de PostgREST. */
export function searchTerm(q: string): string {
  return q.replace(/[,()"\\*%:]/g, " ").replace(/\s+/g, " ").trim();
}

export type ProductListItem = AdminProductRow & {
  min_price: number | null;
  max_price: number | null;
  /** Datos de la única variante (para edición inline). */
  single: { variantId: string; price: number; compareAtPrice: number | null; stock: number; tracked: boolean } | null;
};

export async function listAdminProducts(filters: ProductListFilters) {
  const { supabase, store } = await requireAdmin();
  const db = catalogDb(supabase);
  const from = (filters.page - 1) * PRODUCTS_PER_PAGE;

  let query = db.from("admin_products").select("*", { count: "exact" }).eq("store_id", store.id);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.categoryId) query = query.contains("category_ids", [filters.categoryId]);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.stock === "sin") query = query.eq("stock_state", "out");
  else if (filters.stock === "bajo") query = query.eq("stock_state", "low");
  else if (filters.stock === "con") query = query.in("stock_state", ["ok", "low", "untracked"]);
  const term = searchTerm(filters.q);
  if (term) {
    const like = `*${term}*`;
    query = query.or(`name.ilike."${like}",brand.ilike."${like}",skus.ilike."${like}",slug.ilike."${like}"`);
  }

  switch (filters.sort) {
    case "nombre":
      query = query.order("name", { ascending: true });
      break;
    case "precio":
      query = query.order("min_price", { ascending: true, nullsFirst: false });
      break;
    case "precio-desc":
      query = query.order("max_price", { ascending: false, nullsFirst: false });
      break;
    case "stock":
      query = query.order("total_stock", { ascending: true });
      break;
    case "stock-desc":
      query = query.order("total_stock", { ascending: false });
      break;
    case "nuevos":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }
  query = query.order("id", { ascending: true }).range(from, from + PRODUCTS_PER_PAGE - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdminProductRow[];

  // Datos de la variante única para la edición inline.
  const singleIds = rows.filter((r) => r.variant_count === 1 && r.first_variant_id).map((r) => r.first_variant_id as string);
  const singles = new Map<string, { price: number; compare_at_price: number | null; stock: number; track_inventory: boolean }>();
  if (singleIds.length) {
    const { data: vs } = await supabase
      .from("product_variants")
      .select("id, price, compare_at_price, stock, track_inventory")
      .eq("store_id", store.id)
      .in("id", singleIds);
    for (const v of vs ?? []) singles.set(v.id, v);
  }

  const items: ProductListItem[] = rows.map((r) => {
    const v = r.first_variant_id ? singles.get(r.first_variant_id) : undefined;
    return {
      ...r,
      min_price: r.min_price === null ? null : Number(r.min_price),
      max_price: r.max_price === null ? null : Number(r.max_price),
      single:
        r.variant_count === 1 && v && r.first_variant_id
          ? {
              variantId: r.first_variant_id,
              price: Number(v.price),
              compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
              stock: v.stock,
              tracked: v.track_inventory,
            }
          : null,
    };
  });

  return { items, total: count ?? 0, page: filters.page, perPage: PRODUCTS_PER_PAGE };
}

/** Conteos por estado (pestañas) + sin stock. */
export async function getProductCounts() {
  const { supabase, store } = await requireAdmin();
  const db = catalogDb(supabase);
  const head = { count: "exact" as const, head: true };
  const products = () => supabase.from("products").select("id", head).eq("store_id", store.id);
  const [all, active, draft, archived, out] = await Promise.all([
    products(),
    products().eq("status", "active"),
    products().eq("status", "draft"),
    products().eq("status", "archived"),
    db.from("admin_products").select("id", head).eq("store_id", store.id).eq("stock_state", "out").neq("status", "archived"),
  ]);
  return {
    all: all.count ?? 0,
    active: active.count ?? 0,
    draft: draft.count ?? 0,
    archived: archived.count ?? 0,
    outOfStock: out.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Detalle (form)
// ---------------------------------------------------------------------------

export interface AdminVariant {
  id: string;
  title: string;
  option_values: OptionValues;
  sku: string | null;
  barcode: string | null;
  price: number;
  compare_at_price: number | null;
  cost: number | null;
  stock: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  low_stock_threshold: number | null;
  weight_grams: number | null;
  image_id: string | null;
  position: number;
  is_active: boolean;
}

export interface AdminImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
  width: number | null;
  height: number | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  image_url: string | null;
  sku: string | null;
}

export interface AdminProductDetail {
  id: string;
  name: string;
  slug: string;
  description_html: string;
  short_description: string | null;
  status: "draft" | "active" | "archived";
  brand: string | null;
  tags: string[];
  featured: boolean;
  vat_percent: number | null;
  options: OptionInput[];
  seo: { title: string; description: string };
  source: "manual" | "import" | "scrape";
  source_url: string | null;
  specs: SpecRow[];
  related: ProductSummary[];
  category_ids: string[];
  /** Precios por cantidad (migración 0021; [] sin tramos o sin la migración). */
  price_tiers: PriceTier[];
  variants: AdminVariant[];
  images: AdminImage[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  has_orders: boolean;
}

function parseOptions(value: Json): OptionInput[] {
  if (!Array.isArray(value)) return [];
  const out: OptionInput[] = [];
  for (const o of value) {
    if (!o || typeof o !== "object" || Array.isArray(o)) continue;
    const name = typeof o.name === "string" ? o.name : "";
    const values = Array.isArray(o.values) ? o.values.filter((v): v is string => typeof v === "string") : [];
    if (name) out.push({ name, values });
  }
  return out;
}

function parseOptionValues(value: Json): OptionValues {
  const out: OptionValues = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) if (typeof v === "string") out[k] = v;
  }
  return out;
}

function parseSeo(value: Json): { title: string; description: string } {
  const o = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    title: typeof o.title === "string" ? o.title : "",
    description: typeof o.description === "string" ? o.description : "",
  };
}

/** Resumen (nombre, miniatura, SKU) de varios productos, en el orden pedido. */
export async function getProductSummaries(ids: string[]): Promise<ProductSummary[]> {
  if (!ids.length) return [];
  const { supabase, store } = await requireAdmin();
  const { data } = await catalogDb(supabase)
    .from("admin_products")
    .select("id, name, slug, status, image_url, skus")
    .eq("store_id", store.id)
    .in("id", ids);
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      image_url: p.image_url,
      sku: p.skus.trim().split(/\s+/)[0] || null,
    }));
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  if (!isUuid(id)) return null;
  const { supabase, store } = await requireAdmin();
  const { data: p, error } = await supabase
    .from("products")
    .select(
      "*, product_variants(*), product_images(id, url, alt, position, width, height, created_at), product_categories(category_id, position)",
    )
    .eq("store_id", store.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return null;

  const [related, orders] = await Promise.all([
    getProductSummaries(p.related_ids ?? []),
    supabase.from("order_items").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("product_id", id),
  ]);

  const variants = [...(p.product_variants ?? [])]
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
    .map<AdminVariant>((v) => ({
      id: v.id,
      title: v.title,
      option_values: parseOptionValues(v.option_values),
      sku: v.sku,
      barcode: v.barcode,
      price: Number(v.price),
      compare_at_price: v.compare_at_price === null ? null : Number(v.compare_at_price),
      cost: v.cost === null ? null : Number(v.cost),
      stock: v.stock,
      track_inventory: v.track_inventory,
      allow_backorder: v.allow_backorder,
      low_stock_threshold: v.low_stock_threshold,
      weight_grams: v.weight_grams,
      image_id: v.image_id,
      position: v.position,
      is_active: v.is_active,
    }));

  const images = [...(p.product_images ?? [])]
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
    .map<AdminImage>((i) => ({ id: i.id, url: i.url, alt: i.alt, position: i.position, width: i.width, height: i.height }));

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description_html: p.description_html ?? "",
    short_description: p.short_description,
    status: p.status as AdminProductDetail["status"],
    brand: p.brand,
    tags: p.tags ?? [],
    featured: p.featured,
    vat_percent: p.vat_percent === null ? null : Number(p.vat_percent),
    options: parseOptions(p.options),
    seo: parseSeo(p.seo),
    source: p.source as AdminProductDetail["source"],
    source_url: p.source_url,
    specs: parseSpecsJson(p.specs),
    related,
    category_ids: (p.product_categories ?? []).sort((a, b) => a.position - b.position).map((c) => c.category_id),
    price_tiers: normalizePriceTiers(p.price_tiers ?? []),
    variants,
    images,
    created_at: p.created_at,
    updated_at: p.updated_at,
    published_at: p.published_at,
    has_orders: (orders.count ?? 0) > 0,
  };
}

/** Marcas usadas (para sugerencias en el form). */
export async function listBrands(): Promise<string[]> {
  const { supabase, store } = await requireAdmin();
  const { data } = await supabase.from("products").select("brand").eq("store_id", store.id).not("brand", "is", null).limit(2000);
  return [...new Set((data ?? []).map((r) => r.brand).filter((b): b is string => Boolean(b)))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

/** Etiquetas usadas (sugerencias). */
export async function listTags(): Promise<string[]> {
  const { supabase, store } = await requireAdmin();
  const { data } = await supabase.from("products").select("tags").eq("store_id", store.id).not("tags", "eq", "{}").limit(2000);
  const set = new Set<string>();
  for (const r of data ?? []) for (const t of r.tags ?? []) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}
