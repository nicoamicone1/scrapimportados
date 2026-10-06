/**
 * Importa un catálogo JSON a Supabase (por defecto el de DAZ, `data/products.json`).
 *
 *   SEED_EMAIL=admin@ecommy.local SEED_PASSWORD='…' npm run seed
 *   SEED_STORE=mi-tienda npm run seed  # tienda destino por slug (default: demo)
 *   SEED_FILE=data/otro.json npm run seed  # otro archivo con el mismo formato
 *   npm run seed -- --dry-run         # valida el JSON y lista lo que haría, sin tocar la base
 *   npm run seed -- --skip-images     # usa las URLs remotas (imagesRemote) sin subir nada
 *   npm run seed -- --force-images    # reemplaza las imágenes de productos que ya tenían
 *   npm run seed -- --placeholders    # productos sin imágenes: sube una de ejemplo (SVG) por color
 *
 * Formato: data/SCHEMA.md. Los productos pueden traer, opcionalmente,
 * `options` + `variants` (talle × color con stock por variante), `price`,
 * `compareAt`, `cost`, `priceTiers`, `featured` y `tags`; sin `variants` se
 * crea una sola variante "Default" como siempre (retrocompatible).
 *
 * Corre como un admin logueado (RLS), sin service-role key, sobre UNA tienda
 * (`SEED_STORE`): el usuario tiene que ser dueño o admin de esa tienda. Es
 * idempotente dentro de la tienda: categorías por (`store_id`, `external_id`),
 * productos por (`store_id`, `source`, `external_id`), variantes por
 * (`product_id`, `option_values`). En productos existentes NO pisa el stock
 * (sólo precio, costo y SKU) ni las imágenes (salvo --force-images). Las
 * imágenes se suben a `media/<store_id>/products/<productId>/…`.
 *
 * `scripts/seed-demo-ropa.mts` reutiliza este módulo (loadSource, printPlan,
 * connect, resolveStore, seedCatalog) para la tienda demo de ropa.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { optionKey, variantTitle, type OptionValues } from "../src/lib/admin/variant-matrix";
import { MEDIA_BUCKET, mediaPath } from "../src/lib/media";
import { productSchema, type ProductInput } from "../src/lib/schemas/product";
import { slugify } from "../src/lib/slug";
import type { Database, Json } from "../src/lib/supabase/database.types";

import { placeholderSvg } from "./lib/placeholder-svg.mjs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: se usan las variables del entorno.
}

// ---------------------------------------------------------------------------
// Formato del JSON (ver data/SCHEMA.md)
// ---------------------------------------------------------------------------

const priceSchema = z.object({ base: z.number(), final: z.number() });

const sourceCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string().min(1),
  parent: z.number().int().default(0),
});

const sourceVariantSchema = z.object({
  /** {"Color": "Negro", "Talle": "M"}: una entrada por opción del producto. */
  options: z.record(z.string()).default({}),
  sku: z.string().trim().max(64).optional(),
  /** Si falta, el `price` del producto. */
  price: z.number().positive().optional(),
  compareAt: z.number().positive().optional(),
  stock: z.number().int().min(0).max(9_999_999),
});

const sourceProductSchema = z
  .object({
    id: z.number().int(),
    sku: z.string().default(""),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    permalink: z.string().optional(),
    images: z.array(z.string()).default([]),
    imagesRemote: z.array(z.string()).optional(),
    categories: z.array(z.object({ id: z.number().int(), name: z.string(), slug: z.string() })).default([]),
    inStock: z.boolean().optional(),
    shortDescription: z.string().nullish(),
    /** Formato DAZ: venta = web.final, costo = efectivo.base. */
    prices: z.object({ efectivo: priceSchema, web: priceSchema }).optional(),
    /** Formato catálogo propio: precio de venta (pisa a `prices`). */
    price: z.number().positive().optional(),
    compareAt: z.number().positive().optional(),
    cost: z.number().min(0).optional(),
    featured: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    priceTiers: z.array(z.object({ min_qty: z.number().int(), price: z.number() })).optional(),
    options: z.array(z.object({ name: z.string(), values: z.array(z.string()) })).optional(),
    variants: z.array(sourceVariantSchema).min(1).optional(),
  })
  .passthrough()
  .superRefine((p, ctx) => {
    if (p.price === undefined && !p.prices) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Falta `price` (o `prices` en formato DAZ)." });
    }
    if (p.variants && !p.options) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Con `variants` hace falta `options`." });
    }
  });

export const sourceFileSchema = z
  .object({
    scrapedAt: z.string().default(""),
    source: z.string().min(1),
    /** Nombre de color → hex, para las imágenes de ejemplo (--placeholders). */
    swatches: z.record(z.string()).optional(),
    categories: z.array(sourceCategorySchema),
    products: z.array(sourceProductSchema),
  })
  .passthrough();

export type SourceFile = z.output<typeof sourceFileSchema>;
export type SourceProduct = SourceFile["products"][number];

/** ¿Producto con talles/colores propios (formato nuevo)? */
function hasVariants(p: SourceProduct): p is SourceProduct & { variants: NonNullable<SourceProduct["variants"]> } {
  return Array.isArray(p.variants);
}

function salePrice(p: SourceProduct): number {
  return p.price ?? p.prices?.web.final ?? 0;
}

function costOf(p: SourceProduct): number | null {
  return p.cost ?? p.prices?.efectivo.base ?? null;
}

/** El producto como lo valida el panel (productSchema), para el --dry-run y antes de escribir. */
function toProductInput(p: SourceProduct & { variants: NonNullable<SourceProduct["variants"]> }): ProductInput {
  const options = p.options ?? [];
  return {
    name: p.name,
    slug: p.slug,
    description_html: p.shortDescription ? `<p>${escapeHtml(p.shortDescription)}</p>` : "",
    short_description: p.shortDescription ?? null,
    status: "active",
    featured: p.featured ?? false,
    tags: p.tags ?? [],
    options,
    variants: p.variants.map((v) => ({
      title: variantTitle(v.options, options),
      option_values: v.options,
      sku: v.sku ?? null,
      price: v.price ?? salePrice(p),
      compare_at_price: v.compareAt ?? p.compareAt ?? null,
      cost: costOf(p),
      stock: v.stock,
    })),
    price_tiers: p.priceTiers ?? [],
  };
}

export interface SourceIssue {
  product: string;
  message: string;
}

/** Errores del panel (productSchema) en los productos con variantes y SKUs repetidos en el archivo. */
export function validateCatalog(source: SourceFile): SourceIssue[] {
  const issues: SourceIssue[] = [];
  const skus = new Map<string, string>();
  const slugs = new Map<string, string>();
  const catIds = new Set(source.categories.map((c) => c.id));
  for (const p of source.products) {
    const prev = slugs.get(p.slug);
    if (prev) issues.push({ product: p.name, message: `slug «${p.slug}» repetido (también «${prev}»)` });
    slugs.set(p.slug, p.name);
    for (const c of p.categories) {
      if (!catIds.has(c.id)) issues.push({ product: p.name, message: `categoría ${c.id} («${c.name}») no está en categories` });
    }
    if (!hasVariants(p)) continue;
    const parsed = productSchema.safeParse(toProductInput(p));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) issues.push({ product: p.name, message: `${issue.path.join(".")}: ${issue.message}` });
    }
    for (const v of p.variants) {
      if (!v.sku) continue;
      const key = v.sku.toLowerCase();
      const owner = skus.get(key);
      if (owner) issues.push({ product: p.name, message: `SKU ${v.sku} repetido (también en «${owner}»)` });
      skus.set(key, p.name);
    }
  }
  return issues;
}

/** Lee y valida el archivo (formato + reglas del panel). Corta con un error legible. */
export async function loadSource(file: string): Promise<SourceFile> {
  const full = path.resolve(process.cwd(), file);
  const raw = await readFile(full, "utf8");
  const parsed = sourceFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const lines = parsed.error.issues.slice(0, 20).map((i) => `  · ${i.path.join(".")}: ${i.message}`);
    throw new Error(`${file} no tiene el formato esperado:\n${lines.join("\n")}`);
  }
  const issues = validateCatalog(parsed.data);
  if (issues.length) {
    const lines = issues.slice(0, 30).map((i) => `  · ${i.product}: ${i.message}`);
    throw new Error(`${file} tiene ${issues.length} error(es):\n${lines.join("\n")}`);
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function log(msg: string) {
  console.info(`[seed] ${msg}`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: sin datos`);
  return result.data;
}

async function pool<T>(items: T[], size: number, fn: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

const ars = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
/** `$ 26.000` (BRAND.md §3.1). */
export function money(n: number): string {
  return `$ ${ars.format(n)}`;
}

/** Valores de la opción "Color" (o la primera opción) de un producto. */
function colorValues(p: SourceProduct): { option: string; values: string[] } | null {
  const options = p.options ?? [];
  const color = options.find((o) => o.name.toLowerCase() === "color") ?? null;
  return color ? { option: color.name, values: color.values } : null;
}

function sizeLine(p: SourceProduct): string {
  const talle = (p.options ?? []).find((o) => o.name.toLowerCase() === "talle");
  return talle ? `Talles ${talle.values.join(" · ")}` : "Talle único";
}

// ---------------------------------------------------------------------------
// Plan (--dry-run): qué crearía, sin tocar la base
// ---------------------------------------------------------------------------

export interface PlanOptions {
  file: string;
  storeSlug: string;
  placeholders: boolean;
}

export function printPlan(source: SourceFile, opts: PlanOptions) {
  const variantProducts = source.products.filter(hasVariants);
  const allVariants = variantProducts.flatMap((p) => p.variants);
  const usable = source.categories.filter((c) => c.name.trim() && c.name.trim() !== "–");

  log(`Archivo: ${opts.file} · válido (formato + reglas del panel)`);
  log(`Tienda destino: «${opts.storeSlug}» · --dry-run: no se conecta a la base`);
  log(`Categorías (${usable.length}):`);
  for (const c of usable) {
    const n = source.products.filter((p) => p.categories.some((pc) => pc.id === c.id)).length;
    console.info(`    ${c.name} · ${n} productos`);
  }

  log(`Productos (${source.products.length}):`);
  const shown = source.products.slice(0, 60);
  for (const p of shown) {
    const parts = [money(salePrice(p))];
    if (p.compareAt) parts.push(`antes ${money(p.compareAt)}`);
    if (hasVariants(p)) {
      const stock = p.variants.reduce((s, v) => s + v.stock, 0);
      const out = p.variants.filter((v) => v.stock === 0).length;
      const low = p.variants.filter((v) => v.stock > 0 && v.stock <= 2).length;
      parts.push(`${p.variants.length} variantes`, stock === 0 ? "SIN STOCK (Avisame cuando vuelva)" : `stock ${stock}`);
      if (stock > 0 && out) parts.push(`${out} agotadas`);
      if (low) parts.push(`${low} con 1 o 2`);
    } else {
      parts.push(p.inStock === false ? "sin stock" : "1 variante");
    }
    if (p.priceTiers?.length) parts.push(`por cantidad: ${p.priceTiers.map((t) => `${t.min_qty}+ ${money(t.price)}`).join(", ")}`);
    if (p.featured) parts.push("destacado");
    console.info(`    ${p.name} · ${parts.join(" · ")}`);
  }
  if (source.products.length > shown.length) console.info(`    … y ${source.products.length - shown.length} más`);

  const withoutImages = source.products.filter((p) => p.images.length === 0);
  const placeholderCount = withoutImages.reduce((n, p) => n + (colorValues(p)?.values.length ?? 1), 0);
  log("Resumen:");
  console.info(`    ${source.products.length} productos · ${variantProducts.length} con talles/colores · ${allVariants.length} variantes`);
  if (allVariants.length) {
    const soldOut = variantProducts.filter((p) => p.variants.every((v) => v.stock === 0)).map((p) => p.name);
    console.info(
      `    variantes en 0: ${allVariants.filter((v) => v.stock === 0).length} · con 2: ${allVariants.filter((v) => v.stock === 2).length} · stock total ${allVariants.reduce((s, v) => s + v.stock, 0)}`,
    );
    console.info(`    sin stock total: ${soldOut.length ? soldOut.join(", ") : "ninguno"}`);
  }
  console.info(`    con precio por cantidad: ${source.products.filter((p) => p.priceTiers?.length).length}`);
  console.info(
    opts.placeholders
      ? `    imágenes de ejemplo (SVG) a subir: ${placeholderCount} (${withoutImages.length} productos sin fotos)`
      : `    productos sin imágenes: ${withoutImages.length} (sin --placeholders quedan sin foto)`,
  );
}

// ---------------------------------------------------------------------------
// Conexión
// ---------------------------------------------------------------------------

function newClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient<Database>(url, anonKey, { auth: { persistSession: false } });
}

export type Db = ReturnType<typeof newClient>;

/** Cliente logueado con SEED_EMAIL / SEED_PASSWORD (RLS de un admin, sin service-role). */
export async function connect(): Promise<Db> {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  if (!email || !password) throw new Error("Definí SEED_EMAIL y SEED_PASSWORD (un admin activo)");
  const supabase = newClient();
  const auth = await supabase.auth.signInWithPassword({ email, password });
  if (auth.error) throw new Error(`Login falló: ${auth.error.message}`);
  log(`Logueado como ${email}`);
  return supabase;
}

export interface SeedStore {
  id: string;
  slug: string;
  name: string;
}

/** Tienda por slug; el usuario tiene que ser dueño o admin activo. `null` si no existe (o no es visible). */
export async function findStore(supabase: Db, slug: string): Promise<SeedStore | null> {
  const store = await supabase.from("stores").select("id, name, slug").eq("slug", slug).maybeSingle();
  if (store.error) throw new Error(`Leer tienda: ${store.error.message}`);
  if (!store.data) return null;
  const isAdmin = await supabase.rpc("is_store_admin", { p_store_id: store.data.id });
  if (!isAdmin.data) throw new Error(`${process.env.SEED_EMAIL} no es dueño ni admin activo de «${slug}»`);
  return store.data;
}

export async function resolveStore(supabase: Db, slug: string): Promise<SeedStore> {
  const store = await findStore(supabase, slug);
  if (!store) throw new Error(`No existe la tienda «${slug}» (o no sos miembro). Definí SEED_STORE con el slug.`);
  return store;
}

// ---------------------------------------------------------------------------
// Siembra
// ---------------------------------------------------------------------------

const DEFAULT_STOCK = 10;
const BATCH = 100;
const UPLOAD_CONCURRENCY = 8;

export interface SeedOptions {
  skipImages: boolean;
  forceImages: boolean;
  /** Productos sin imágenes: sube una imagen de ejemplo (SVG) por color. */
  placeholders: boolean;
}

type VariantInsert = Database["public"]["Tables"]["product_variants"]["Insert"];

export async function seedCatalog(supabase: Db, store: SeedStore, source: SourceFile, opts: SeedOptions) {
  const storeId = store.id;
  log(`Tienda destino: ${store.name} (${store.slug} · ${storeId})`);
  log(`${source.products.length} productos y ${source.categories.length} categorías en el JSON`);

  // ---------------- Categorías ----------------
  const usable = source.categories.filter((c) => c.name.trim() && c.name.trim() !== "–");
  must(
    await supabase
      .from("categories")
      .upsert(
        usable.map((c, i) => ({
          store_id: storeId,
          external_id: String(c.id),
          name: c.name.trim(),
          slug: c.slug,
          position: i,
          is_visible: true,
        })),
        { onConflict: "store_id,external_id" },
      )
      .select("id"),
    "upsert categorías",
  );
  const catRows = must(
    await supabase.from("categories").select("id, external_id").eq("store_id", storeId).not("external_id", "is", null),
    "leer categorías",
  );
  const catByExt = new Map(catRows.map((c) => [c.external_id as string, c.id]));
  // Jerarquía (segunda pasada, cuando ya existen todos los ids).
  for (const c of usable) {
    const parentId = c.parent ? catByExt.get(String(c.parent)) ?? null : null;
    const id = catByExt.get(String(c.id));
    if (!id) continue;
    const r = await supabase.from("categories").update({ parent_id: parentId }).eq("store_id", storeId).eq("id", id);
    if (r.error) throw new Error(`jerarquía ${c.name}: ${r.error.message}`);
  }
  log(`Categorías: ${usable.length} (con jerarquía)`);

  // ---------------- Productos ----------------
  const now = new Date().toISOString();
  const productIdByExt = new Map<string, string>();
  for (const [i, batch] of chunk(source.products, BATCH).entries()) {
    const rows = must(
      await supabase
        .from("products")
        .upsert(
          batch.map((p) => ({
            store_id: storeId,
            name: p.name.trim(),
            slug: p.slug,
            short_description: p.shortDescription?.trim() || null,
            description_html: p.shortDescription?.trim() ? `<p>${escapeHtml(p.shortDescription.trim())}</p>` : null,
            status: "active",
            source: "import",
            source_url: p.permalink ?? null,
            external_id: String(p.id),
            published_at: now,
            metadata: { importedFrom: source.source, scrapedAt: source.scrapedAt, prices: p.prices } as Json,
          })),
          { onConflict: "store_id,source,external_id" },
        )
        .select("id, external_id"),
      "upsert productos",
    );
    for (const r of rows) productIdByExt.set(r.external_id as string, r.id);
    log(`Productos ${Math.min((i + 1) * BATCH, source.products.length)}/${source.products.length}`);
  }

  // Opciones, destacado y etiquetas: sólo en productos con variantes propias
  // (los del formato DAZ no las traen y no se tocan).
  const variantProducts = source.products.filter(hasVariants);
  let tiersSkipped = 0;
  await pool(variantProducts, UPLOAD_CONCURRENCY, async (p) => {
    const productId = productIdByExt.get(String(p.id));
    if (!productId) return;
    const r = await supabase
      .from("products")
      .update({
        options: (p.options ?? []).map((o) => ({ name: o.name, values: o.values })),
        featured: p.featured ?? false,
        tags: p.tags ?? [],
      })
      .eq("store_id", storeId)
      .eq("id", productId);
    if (r.error) throw new Error(`opciones de ${p.name}: ${r.error.message}`);
    // Precios por cantidad aparte: necesitan la migración 0021 y `pricing.tiers` en el plan.
    if (p.priceTiers?.length) {
      const t = await supabase.from("products").update({ price_tiers: p.priceTiers }).eq("store_id", storeId).eq("id", productId);
      if (t.error) {
        tiersSkipped++;
        console.warn(`[seed] ${p.name}: sin precios por cantidad (${t.error.message})`);
      }
    }
  });
  if (variantProducts.length) {
    log(`Opciones (talle/color): ${variantProducts.length} productos${tiersSkipped ? ` · ${tiersSkipped} sin precio por cantidad` : ""}`);
  }

  // ---------------- Variantes ----------------
  const productIds = [...productIdByExt.values()];
  const firstVariant = new Map<string, string>();
  const variantByKey = new Map<string, string>();
  for (const ids of chunk(productIds, 200)) {
    const rows = must(
      await supabase
        .from("product_variants")
        .select("id, product_id, option_values, position")
        .eq("store_id", storeId)
        .in("product_id", ids)
        .order("position"),
      "leer variantes",
    );
    for (const r of rows) {
      if (!firstVariant.has(r.product_id)) firstVariant.set(r.product_id, r.id);
      variantByKey.set(`${r.product_id}|${optionKey((r.option_values ?? {}) as OptionValues)}`, r.id);
    }
  }

  const toInsert: VariantInsert[] = [];
  const toUpdate: { id: string; name: string; patch: Database["public"]["Tables"]["product_variants"]["Update"] }[] = [];
  for (const p of source.products) {
    const productId = productIdByExt.get(String(p.id));
    if (!productId) continue;

    if (!hasVariants(p)) {
      // Formato DAZ: una sola variante "Default".
      const common = { price: salePrice(p), cost: costOf(p), sku: p.sku || null };
      const variantId = firstVariant.get(productId);
      if (variantId) toUpdate.push({ id: variantId, name: p.name, patch: common });
      else {
        toInsert.push({
          ...common,
          store_id: storeId,
          product_id: productId,
          title: "Default",
          option_values: {},
          compare_at_price: null,
          stock: p.inStock === false ? 0 : DEFAULT_STOCK,
          track_inventory: true,
          position: 0,
        });
      }
      continue;
    }

    const options = p.options ?? [];
    p.variants.forEach((v, position) => {
      const common = {
        title: variantTitle(v.options, options),
        price: v.price ?? salePrice(p),
        compare_at_price: v.compareAt ?? p.compareAt ?? null,
        cost: costOf(p),
        sku: v.sku || null,
        position,
      };
      const variantId = variantByKey.get(`${productId}|${optionKey(v.options)}`);
      if (variantId) toUpdate.push({ id: variantId, name: p.name, patch: common });
      else {
        toInsert.push({
          ...common,
          store_id: storeId,
          product_id: productId,
          option_values: v.options,
          stock: v.stock,
          track_inventory: true,
        });
      }
    });
  }

  await pool(toUpdate, UPLOAD_CONCURRENCY, async (u) => {
    const r = await supabase.from("product_variants").update(u.patch).eq("store_id", storeId).eq("id", u.id);
    if (r.error) throw new Error(`variante ${u.name}: ${r.error.message}`);
  });

  let created = 0;
  for (const batch of chunk(toInsert, BATCH)) {
    const rows = must(await supabase.from("product_variants").insert(batch).select("id, stock"), "insertar variantes");
    created += rows.length;
    // Movimiento de inventario inicial (trazabilidad del stock importado).
    const movements = rows
      .filter((v) => v.stock !== 0)
      .map((v) => ({
        store_id: storeId,
        variant_id: v.id,
        delta: v.stock,
        stock_after: v.stock,
        reason: "import",
        note: "Importación inicial",
      }));
    if (movements.length) {
      const r = await supabase.from("inventory_movements").insert(movements);
      if (r.error) throw new Error(`movimientos: ${r.error.message}`);
    }
  }
  log(`Variantes: ${created} creadas, ${toUpdate.length} actualizadas (el stock de las existentes no se toca)`);

  // ---------------- Producto ↔ categoría ----------------
  const links = source.products.flatMap((p) => {
    const productId = productIdByExt.get(String(p.id));
    if (!productId) return [];
    return p.categories
      .map((c, i) => ({ store_id: storeId, product_id: productId, category_id: catByExt.get(String(c.id)), position: i }))
      .filter((l): l is { store_id: string; product_id: string; category_id: string; position: number } => !!l.category_id);
  });
  for (const batch of chunk(links, 500)) {
    const r = await supabase
      .from("product_categories")
      .upsert(batch, { onConflict: "product_id,category_id", ignoreDuplicates: true });
    if (r.error) throw new Error(`categorías de productos: ${r.error.message}`);
  }
  log(`Relaciones producto-categoría: ${links.length}`);

  // ---------------- Imágenes ----------------
  const withImages = new Set<string>();
  for (const ids of chunk(productIds, 200)) {
    const rows = must(
      await supabase.from("product_images").select("product_id").eq("store_id", storeId).in("product_id", ids),
      "leer imágenes",
    );
    for (const r of rows) withImages.add(r.product_id);
  }

  const pending = source.products.filter((p) => {
    const id = productIdByExt.get(String(p.id));
    return id && (opts.forceImages || !withImages.has(id));
  });
  const placeholders = opts.placeholders && !opts.skipImages;
  log(
    `Imágenes: ${pending.length} productos por procesar${opts.skipImages ? " (remotas, sin subir)" : ""}${placeholders ? " (los que no tienen fotos, con imágenes de ejemplo)" : ""}`,
  );

  const upload = async (storagePath: string, bytes: Uint8Array | string, contentType: string) => {
    const up = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
    if (up.error) throw new Error(up.error.message);
    return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  };

  let uploaded = 0;
  let generated = 0;
  let failed = 0;
  await pool(pending, UPLOAD_CONCURRENCY, async (p, index) => {
    const productId = productIdByExt.get(String(p.id))!;
    /** `color`: valor de la opción Color al que corresponde la imagen (para la foto de la variante). */
    const images: { url: string; alt: string; color: string | null }[] = [];

    if (opts.skipImages) {
      for (const u of p.imagesRemote ?? []) images.push({ url: u, alt: p.name, color: null });
    } else {
      for (const local of p.images) {
        const file = path.basename(local);
        try {
          const bytes = await readFile(path.join(process.cwd(), "public", "img", file));
          const type = file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg";
          images.push({ url: await upload(mediaPath(storeId, "products", productId, file), bytes, type), alt: p.name, color: null });
          uploaded++;
        } catch (err) {
          failed++;
          console.warn(`[seed] No se pudo subir ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (placeholders && p.images.length === 0) {
        const colors = colorValues(p)?.values ?? [null];
        for (const color of colors) {
          const svg = placeholderSvg({
            title: p.name,
            color: color ?? undefined,
            detail: sizeLine(p),
            background: (color && source.swatches?.[color]) || source.swatches?.default || "",
          });
          const file = `ejemplo-${slugify(color ?? "producto") || "producto"}.svg`;
          try {
            const url = await upload(mediaPath(storeId, "products", productId, file), svg, "image/svg+xml");
            images.push({ url, alt: color ? `${p.name}, ${color.toLowerCase()}` : p.name, color });
            generated++;
          } catch (err) {
            failed++;
            console.warn(`[seed] No se pudo subir ${file} de ${p.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    if (opts.forceImages) {
      const del = await supabase.from("product_images").delete().eq("store_id", storeId).eq("product_id", productId);
      if (del.error) throw new Error(`borrar imágenes: ${del.error.message}`);
    }
    if (images.length) {
      const ins = await supabase
        .from("product_images")
        .insert(images.map((img, i) => ({ store_id: storeId, product_id: productId, url: img.url, alt: img.alt, position: i })))
        .select("id, position");
      if (ins.error) throw new Error(`insertar imágenes: ${ins.error.message}`);

      // Cada variante muestra la imagen de su color.
      const color = colorValues(p);
      const imageByColor = new Map<string, string>();
      for (const row of ins.data ?? []) {
        const c = images[row.position]?.color;
        if (c) imageByColor.set(c, row.id);
      }
      if (color && imageByColor.size) {
        const variants = must(
          await supabase.from("product_variants").select("id, option_values").eq("store_id", storeId).eq("product_id", productId),
          `variantes de ${p.name}`,
        );
        for (const v of variants) {
          const value = ((v.option_values ?? {}) as OptionValues)[color.option];
          const imageId = value ? imageByColor.get(value) : undefined;
          if (!imageId) continue;
          const r = await supabase.from("product_variants").update({ image_id: imageId }).eq("store_id", storeId).eq("id", v.id);
          if (r.error) throw new Error(`imagen de la variante ${p.name}: ${r.error.message}`);
        }
      }
    }
    if ((index + 1) % 50 === 0) log(`  imágenes ${index + 1}/${pending.length}`);
  });
  log(`Imágenes: ${uploaded} subidas${generated ? `, ${generated} de ejemplo` : ""}, ${failed} con error`);

  const count = await supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId);
  log(`Listo. Productos en «${store.slug}»: ${count.count ?? "?"}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function cliFlags(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  return {
    dryRun: args.has("--dry-run"),
    skipImages: args.has("--skip-images"),
    forceImages: args.has("--force-images"),
    placeholders: args.has("--placeholders"),
  };
}

/** ¿Este archivo es el que se ejecutó (y no un import)? */
export function isEntry(metaUrl: string): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && metaUrl === pathToFileURL(path.resolve(entry)).href;
}

async function main() {
  const flags = cliFlags();
  const file = process.env.SEED_FILE || "data/products.json";
  const storeSlug = (process.env.SEED_STORE || "demo").trim().toLowerCase();

  const source = await loadSource(file);
  if (flags.dryRun) {
    printPlan(source, { file, storeSlug, placeholders: flags.placeholders && !flags.skipImages });
    return;
  }

  const supabase = await connect();
  const store = await resolveStore(supabase, storeSlug);
  await seedCatalog(supabase, store, source, flags);
  await supabase.auth.signOut();
}

if (isEntry(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(`[seed] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
