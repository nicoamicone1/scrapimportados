import fs from "node:fs";
import path from "node:path";

import type { SearchEntry } from "./search";

/* ------------------------------------------------------------------ */
/* Tipos: espejo de data/SCHEMA.md                                      */
/* ------------------------------------------------------------------ */

export interface Category {
  id: number;
  name: string;
  slug: string;
  /** Sólo presente en el listado global de categorías del catálogo. */
  parent?: number;
}

export interface PriceTier {
  /** Precio del proveedor. NO se muestra al cliente final. */
  base: number;
  /** Precio final ya con el markup aplicado. Es el que se muestra. */
  final: number;
}

export interface ProductPrices {
  efectivo: PriceTier;
  /** `null` cuando no se pudo extraer el "Precio web" del proveedor. */
  web: PriceTier | null;
}

export type ProductType = "simple" | "variable" | (string & {});

export interface Product {
  id: number;
  sku: string;
  name: string;
  slug: string;
  permalink: string;
  image: string | null;
  images: string[];
  categories: Category[];
  inStock: boolean;
  onSale: boolean;
  type: ProductType;
  shortDescription: string;
  prices: ProductPrices;
}

export interface Catalog {
  scrapedAt: string;
  source: string;
  markup: number;
  currency: string;
  count: number;
  categories: Category[];
  products: Product[];
}

/* ------------------------------------------------------------------ */
/* Vista pública (lo que se manda al navegador)                         */
/* ------------------------------------------------------------------ */

/**
 * Versión "segura" del producto para el listado del cliente: sólo el precio
 * FINAL. El `base` (costo del proveedor) nunca se serializa al HTML.
 */
export interface CatalogItem {
  id: number;
  sku: string;
  name: string;
  slug: string;
  image: string | null;
  categories: Category[];
  inStock: boolean;
  onSale: boolean;
  type: ProductType;
  prices: {
    efectivo: { final: number };
    web: { final: number } | null;
  };
}

export function toCatalogItem(p: Product): CatalogItem {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    image: p.image,
    categories: p.categories,
    inStock: p.inStock,
    onSale: p.onSale,
    type: p.type,
    prices: {
      efectivo: { final: p.prices.efectivo.final },
      web: p.prices.web ? { final: p.prices.web.final } : null,
    },
  };
}

/** Listado liviano y sin costos de proveedor, para el Client Component. */
export function getCatalogItems(): CatalogItem[] {
  return getProducts().map(toCatalogItem);
}

/**
 * Índice liviano para el buscador del header: se genera en build y viaja
 * como prop al Header (Client Component). Sólo precio FINAL.
 */
export function getSearchIndex(): SearchEntry[] {
  return getProducts().map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    image: p.image,
    priceEfectivo: p.prices.efectivo.final,
  }));
}

/* ------------------------------------------------------------------ */
/* Carga de datos (build time, sólo servidor)                           */
/* ------------------------------------------------------------------ */

const DATA_DIR = path.join(process.cwd(), "data");
const REAL_FILE = path.join(DATA_DIR, "products.json");
const SAMPLE_FILE = path.join(DATA_DIR, "products.sample.json");

let cache: Catalog | null = null;

/**
 * Lee `data/products.json` si existe; si todavía no se scrapeó,
 * cae a `data/products.sample.json`. Se ejecuta sólo en build/servidor.
 */
export function getCatalog(): Catalog {
  if (cache) return cache;

  const file = fs.existsSync(REAL_FILE) ? REAL_FILE : SAMPLE_FILE;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Catalog>;

  const products = (raw.products ?? []).map(normalizeProduct);

  cache = {
    scrapedAt: raw.scrapedAt ?? new Date().toISOString(),
    source: raw.source ?? "",
    markup: typeof raw.markup === "number" ? raw.markup : 0.2,
    currency: raw.currency ?? "ARS",
    count: typeof raw.count === "number" ? raw.count : products.length,
    categories: raw.categories ?? [],
    products,
  };

  return cache;
}

function normalizeProduct(p: Product): Product {
  return {
    ...p,
    image: p.image ?? null,
    images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
    // Se descarta la categoría basura del proveedor ("–", id 480, sin nombre real).
    categories: Array.isArray(p.categories) ? p.categories.filter((c) => /\p{L}/u.test(c.name)) : [],
    shortDescription: p.shortDescription ?? "",
  };
}

/** ¿Se está usando el archivo de muestra? (útil para avisar en la UI) */
export function isSampleData(): boolean {
  return !fs.existsSync(REAL_FILE);
}

export function getProducts(): Product[] {
  return getCatalog().products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return getProducts().find((p) => p.slug === slug);
}

/** Categorías realmente presentes en los productos, ordenadas alfabéticamente. */
export function getUsedCategories(): Category[] {
  const map = new Map<string, Category>();
  for (const p of getProducts()) {
    for (const c of p.categories) {
      if (!map.has(c.slug)) map.set(c.slug, { id: c.id, name: c.name, slug: c.slug });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es-AR"));
}

/* ------------------------------------------------------------------ */
/* Helpers de formato                                                   */
/* ------------------------------------------------------------------ */

// Viven en `./format` (módulo puro) para que los Client Components puedan
// usarlos sin arrastrar `node:fs`. Se re-exportan acá por comodidad.
export { formatARS, formatDateAR, formatPrice, isVariable } from "./format";
