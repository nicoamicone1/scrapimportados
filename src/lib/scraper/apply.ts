import "server-only";

/**
 * Fase "apply": crea / actualiza productos a partir del formato normalizado
 * y aplica las filas del CSV de actualización.
 *
 * Reglas (spec §3.8, P0-04):
 * - Existentes por `external_id` tratando `source` 'import' y 'scrape' como
 *   equivalentes, desempatando por el host de `source_url` (el catálogo DAZ
 *   se sembró con source='import'; una re-sincronización lo reconoce).
 *   En el CSV de creación, por `slug` (= handle).
 * - Productos existentes: NO se pisan nombre, descripción ni estado; sólo
 *   precios (si `sync_prices`), stock (si `sync_stock`), variantes nuevas,
 *   categorías faltantes e imágenes nuevas.
 * - Stock SIEMPRE por `rpc('adjust_stock', reason 'import')` con delta.
 * - Cambios de precio logueados en `price_changes` con `batch_id = jobId`
 *   (el "Deshacer" de Precios también cubre importaciones).
 */
import type { ImportOptions } from "@/lib/schemas/import";
import { sanitizeHtml } from "@/lib/html";
import { uniqueSlug, slugify } from "@/lib/slug";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

import type { CsvUpdateDiff } from "./csv";
import { toJson } from "./job";
import { applyMarkup, hostOf, isJunkCategory } from "./text";
import type { NormalizedCategory, NormalizedProduct, NormalizedVariant } from "./types";

const MAX_VARIANTS = 250;

export interface ApplyContext {
  db: ServerSupabase;
  userId: string;
  jobId: string;
  adapter: string;
  sourceHost: string;
  options: ImportOptions;
  categoryDefs: Record<string, NormalizedCategory>;
  categoryCache: Map<string, string>;
  touchedSlugs: Set<string>;
  categoriesCreated: number;
  csvFileName?: string;
}

export type ApplyStatus = "imported" | "updated" | "skipped" | "error";

export interface ApplyResult {
  status: ApplyStatus;
  productId: string | null;
  message: string | null;
  priceChanges: number;
}

class ApplyError extends Error {}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error) throw new ApplyError(`${what}: ${res.error.message}`);
  if (res.data === null || res.data === undefined) throw new ApplyError(`${what}: sin datos`);
  return res.data as NonNullable<T>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Clave estable de `option_values` (orden de claves irrelevante). */
export function optionKey(values: Record<string, string> | Json | null | undefined): string {
  if (!isRecord(values)) return "{}";
  const entries = Object.entries(values)
    .map(([k, v]) => [k.trim().toLowerCase(), String(v).trim().toLowerCase()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

const sameMoney = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 0.005;

// ---------------------------------------------------------------------------
// Precios y stock
// ---------------------------------------------------------------------------

interface PriceSet {
  price: number;
  compare_at_price: number | null;
  cost: number | null;
}

function priceFor(v: NormalizedVariant, opts: ImportOptions, isCsv: boolean): PriceSet | null {
  const price = applyMarkup(v.price, opts.markup_percent, opts.round_to);
  if (price === null) return null;
  let compare = v.compare_at_price ? applyMarkup(v.compare_at_price, opts.markup_percent, opts.round_to) : null;
  if (compare !== null && compare <= price) compare = null;
  // Con recargo, el precio de origen es nuestro costo (proveedor mayorista).
  const cost = v.cost ?? (!isCsv && opts.markup_percent > 0 && v.price !== null ? v.price : null);
  return { price, compare_at_price: compare, cost };
}

/** Stock objetivo para una variante NUEVA. */
function initialStock(v: NormalizedVariant, opts: ImportOptions): number {
  if (typeof v.stock === "number") return Math.max(0, Math.round(v.stock));
  if (v.in_stock === false) return 0;
  return opts.stock_when_unknown;
}

/** Stock objetivo para una variante EXISTENTE (null = no tocar). */
function syncedStock(v: NormalizedVariant, current: number, opts: ImportOptions): number | null {
  if (typeof v.stock === "number") return Math.max(0, Math.round(v.stock));
  if (v.in_stock === false) return 0;
  // La fuente sólo dice "hay stock": si ya tenemos stock positivo, se respeta.
  if (current > 0) return null;
  return opts.stock_when_unknown;
}

async function adjustStock(ctx: ApplyContext, variantId: string, delta: number, note: string) {
  if (!delta) return;
  const r = await ctx.db.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: "import",
    p_note: note,
  });
  if (r.error) throw new ApplyError(`stock: ${r.error.message}`);
}

async function logPriceChange(
  ctx: ApplyContext,
  variantId: string,
  before: { price: number; compare_at_price: number | null },
  after: { price: number; compare_at_price: number | null },
) {
  const r = await ctx.db.from("price_changes").insert({
    batch_id: ctx.jobId,
    variant_id: variantId,
    old_price: before.price,
    old_compare_at: before.compare_at_price,
    new_price: after.price,
    new_compare_at: after.compare_at_price,
    created_by: ctx.userId,
  });
  if (r.error) throw new ApplyError(`historial de precios: ${r.error.message}`);
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

/**
 * Devuelve el id local de una categoría del origen, creándola (con su padre)
 * si hace falta. Busca por external_id con namespace de host, después por
 * external_id "plano" + slug (catálogo sembrado) y por slug + padre.
 */
async function resolveCategory(ctx: ApplyContext, cat: NormalizedCategory, depth = 0): Promise<string | null> {
  const cached = ctx.categoryCache.get(cat.externalId);
  if (cached) return cached;
  if (depth > 6 || isJunkCategory(cat.name)) return null;

  const parentDef = cat.parentExternalId ? ctx.categoryDefs[cat.parentExternalId] : undefined;
  const parentId = parentDef ? await resolveCategory(ctx, parentDef, depth + 1) : null;
  const namespaced = `${ctx.adapter === "csv" ? "csv" : ctx.sourceHost}:${cat.externalId}`.slice(0, 250);
  const slug = slugify(cat.slug || cat.name) || slugify(cat.name) || "categoria";

  let id: string | null = null;
  const byNs = await ctx.db.from("categories").select("id").eq("external_id", namespaced).maybeSingle();
  id = byNs.data?.id ?? null;

  if (!id && ctx.adapter !== "csv") {
    const byPlain = await ctx.db.from("categories").select("id").eq("external_id", cat.externalId).eq("slug", slug).maybeSingle();
    id = byPlain.data?.id ?? null;
  }
  if (!id) {
    let q = ctx.db.from("categories").select("id, external_id").eq("slug", slug);
    q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
    const bySlug = await q.maybeSingle();
    if (bySlug.data) {
      id = bySlug.data.id;
      if (!bySlug.data.external_id) {
        await ctx.db.from("categories").update({ external_id: namespaced }).eq("id", id);
      }
    }
  }
  if (!id) {
    const free = await uniqueSlug(slug, async (s) => {
      const r = await ctx.db.from("categories").select("id").eq("slug", s).maybeSingle();
      return Boolean(r.data);
    });
    const ins = must(
      await ctx.db
        .from("categories")
        .insert({ name: cat.name.slice(0, 120), slug: free, parent_id: parentId, external_id: namespaced, is_visible: true, position: 0 })
        .select("id")
        .single(),
      `crear categoría ${cat.name}`,
    );
    id = ins.id;
    ctx.categoriesCreated += 1;
  }
  ctx.categoryCache.set(cat.externalId, id);
  return id;
}

async function linkCategories(ctx: ApplyContext, productId: string, product: NormalizedProduct) {
  const ids: string[] = [];
  if (ctx.options.category_mode === "single" && ctx.options.default_category_id) {
    ids.push(ctx.options.default_category_id);
  } else if (ctx.options.category_mode === "create") {
    for (const def of product.categoryDefs ?? []) ctx.categoryDefs[def.externalId] ??= def;
    for (const cat of product.categories.slice(0, 10)) {
      const merged = ctx.categoryDefs[cat.externalId] ?? cat;
      // Categorías "vacías" del origen ("–", "-", "Sin categoría"/"Uncategorized") no se crean.
      if (isJunkCategory(merged.name)) continue;
      const id = await resolveCategory(ctx, merged);
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  if (!ids.length) return;
  const r = await ctx.db
    .from("product_categories")
    .upsert(
      ids.map((category_id, position) => ({ product_id: productId, category_id, position })),
      { onConflict: "product_id,category_id", ignoreDuplicates: true },
    );
  if (r.error) throw new ApplyError(`categorías: ${r.error.message}`);
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

interface ExistingProduct {
  id: string;
  slug: string;
  options: Json;
  metadata: Json;
}

async function findExisting(ctx: ApplyContext, product: NormalizedProduct): Promise<ExistingProduct | null> {
  if (ctx.adapter === "csv") {
    if (!product.slug) return null;
    const r = await ctx.db.from("products").select("id, slug, options, metadata").eq("slug", product.slug).maybeSingle();
    return r.data ?? null;
  }
  const r = await ctx.db
    .from("products")
    .select("id, slug, options, metadata, source_url")
    .eq("external_id", product.externalId)
    .in("source", ["import", "scrape"]);
  const rows = r.data ?? [];
  const hit = rows.find((p) => hostOf(p.source_url) === ctx.sourceHost) ?? null;
  return hit ? { id: hit.id, slug: hit.slug, options: hit.options, metadata: hit.metadata } : null;
}

function variantInsert(
  productId: string,
  v: NormalizedVariant,
  prices: PriceSet,
  position: number,
): TablesInsert<"product_variants"> {
  return {
    product_id: productId,
    title: (v.title || "Default").slice(0, 200),
    option_values: v.option_values,
    sku: v.sku?.slice(0, 100) || null,
    barcode: v.barcode?.slice(0, 64) || null,
    price: prices.price,
    compare_at_price: prices.compare_at_price,
    cost: prices.cost,
    stock: 0,
    track_inventory: true,
    weight_grams: v.weight_grams ?? null,
    position,
    is_active: true,
  };
}

async function insertVariants(ctx: ApplyContext, productId: string, variants: NormalizedVariant[], startPosition: number) {
  const isCsv = ctx.adapter === "csv";
  const rows: { v: NormalizedVariant; insert: TablesInsert<"product_variants"> }[] = [];
  variants.forEach((v, i) => {
    const prices = priceFor(v, ctx.options, isCsv);
    if (prices) rows.push({ v, insert: variantInsert(productId, v, prices, startPosition + i) });
  });
  if (!rows.length) return 0;
  const inserted = must(
    await ctx.db.from("product_variants").insert(rows.map((r) => r.insert)).select("id, option_values"),
    "crear variantes",
  );
  const byKey = new Map(inserted.map((r) => [optionKey(r.option_values), r.id]));
  for (const { v } of rows) {
    const id = byKey.get(optionKey(v.option_values));
    const qty = initialStock(v, ctx.options);
    if (id && qty > 0) await adjustStock(ctx, id, qty, `Importación ${ctx.jobId.slice(0, 8)}`);
  }
  return rows.length;
}

function mergeOptions(current: Json, incoming: NormalizedProduct["options"]): { name: string; values: string[] }[] {
  const out: { name: string; values: string[] }[] = Array.isArray(current)
    ? current.flatMap((o) =>
        isRecord(o) ? [{ name: String(o.name ?? ""), values: Array.isArray(o.values) ? o.values.map(String) : [] }] : [],
      )
    : [];
  for (const opt of incoming) {
    const hit = out.find((o) => o.name.toLowerCase() === opt.name.toLowerCase());
    if (!hit) out.push({ name: opt.name, values: [...opt.values] });
    else for (const v of opt.values) if (!hit.values.some((x) => x.toLowerCase() === v.toLowerCase())) hit.values.push(v);
  }
  return out;
}

async function createProduct(ctx: ApplyContext, product: NormalizedProduct): Promise<ApplyResult> {
  const priced = product.variants.filter((v) => v.price !== null && v.price >= 0);
  if (!priced.length) return { status: "error", productId: null, message: "Sin precio en la fuente.", priceChanges: 0 };

  const baseSlug = slugify(product.slug || product.name) || "producto";
  const slug = await uniqueSlug(baseSlug, async (s) => {
    const r = await ctx.db.from("products").select("id").eq("slug", s).maybeSingle();
    return Boolean(r.data);
  });
  const isCsv = ctx.adapter === "csv";
  const status = product.status ?? ctx.options.default_status;
  const now = new Date().toISOString();
  const desc = sanitizeHtml(product.description_html ?? "");

  const insert: TablesInsert<"products"> = {
    name: product.name.slice(0, 250),
    slug,
    description_html: desc || null,
    short_description: product.short_description?.slice(0, 500) || null,
    status,
    brand: product.brand?.slice(0, 120) || null,
    tags: product.tags.slice(0, 30),
    options: toJson(product.options.filter((o) => o.values.length)),
    seo: toJson(product.seo ?? {}),
    source: isCsv ? "import" : "scrape",
    source_url: product.source_url || null,
    external_id: isCsv ? null : product.externalId,
    published_at: status === "active" ? now : null,
    metadata: toJson({
      import: { jobId: ctx.jobId, source: ctx.sourceHost || null, importedAt: now },
      imagesRemote: [],
    }),
  };
  const created = must(await ctx.db.from("products").insert(insert).select("id, slug").single(), "crear producto");

  try {
    await insertVariants(ctx, created.id, priced.slice(0, MAX_VARIANTS), 0);
    await linkCategories(ctx, created.id, product);
  } catch (err) {
    // Sin variantes el producto queda roto: se borra y se informa el error.
    await ctx.db.from("products").delete().eq("id", created.id);
    throw err;
  }
  ctx.touchedSlugs.add(created.slug);
  const skippedVariants = product.variants.length - Math.min(priced.length, MAX_VARIANTS);
  return {
    status: "imported",
    productId: created.id,
    message: skippedVariants > 0 ? `${skippedVariants} variantes sin precio o de más no se importaron.` : null,
    priceChanges: 0,
  };
}

async function updateProduct(ctx: ApplyContext, existing: ExistingProduct, product: NormalizedProduct): Promise<ApplyResult> {
  const { options } = ctx;
  const isCsv = ctx.adapter === "csv";
  const variants = must(
    await ctx.db
      .from("product_variants")
      .select("id, option_values, sku, price, compare_at_price, cost, stock, position")
      .eq("product_id", existing.id)
      .order("position"),
    "leer variantes",
  );
  const byKey = new Map(variants.map((v) => [optionKey(v.option_values), v]));
  const bySku = new Map(variants.filter((v) => v.sku).map((v) => [String(v.sku).toLowerCase(), v]));

  let changed = 0;
  let priceChanges = 0;
  const toCreate: NormalizedVariant[] = [];
  const note = `Importación ${ctx.jobId.slice(0, 8)}`;

  for (const v of product.variants.slice(0, MAX_VARIANTS)) {
    const match =
      byKey.get(optionKey(v.option_values)) ??
      (v.sku ? bySku.get(v.sku.toLowerCase()) : undefined) ??
      (variants.length === 1 && product.variants.length === 1 ? variants[0] : undefined);

    if (!match) {
      if (v.price !== null) toCreate.push(v);
      continue;
    }

    if (options.sync_prices) {
      const next = priceFor(v, options, isCsv);
      if (next) {
        const priceMoved = !sameMoney(next.price, match.price) || !sameMoney(next.compare_at_price, match.compare_at_price);
        const costMoved = next.cost !== null && !sameMoney(next.cost, match.cost);
        if (priceMoved || costMoved) {
          const r = await ctx.db
            .from("product_variants")
            .update({
              price: next.price,
              compare_at_price: next.compare_at_price,
              ...(next.cost !== null ? { cost: next.cost } : {}),
            })
            .eq("id", match.id);
          if (r.error) throw new ApplyError(`actualizar precio: ${r.error.message}`);
          if (priceMoved) {
            await logPriceChange(ctx, match.id, match, next);
            priceChanges += 1;
          }
          changed += 1;
        }
      }
    }

    if (options.sync_stock) {
      const target = syncedStock(v, match.stock, options);
      if (target !== null && target !== match.stock) {
        await adjustStock(ctx, match.id, target - match.stock, note);
        changed += 1;
      }
    }
  }

  if (toCreate.length) {
    const maxPos = variants.reduce((m, v) => Math.max(m, v.position), -1);
    changed += await insertVariants(ctx, existing.id, toCreate, maxPos + 1);
  }

  const meta = isRecord(existing.metadata) ? existing.metadata : {};
  const patch: { metadata: Json; options?: Json } = {
    metadata: toJson({ ...meta, lastImport: { jobId: ctx.jobId, at: new Date().toISOString() } }),
  };
  if (toCreate.length) patch.options = toJson(mergeOptions(existing.options, product.options));
  const up = await ctx.db.from("products").update(patch).eq("id", existing.id);
  if (up.error) throw new ApplyError(`actualizar producto: ${up.error.message}`);

  await linkCategories(ctx, existing.id, product);
  ctx.touchedSlugs.add(existing.slug);

  return changed > 0
    ? { status: "updated", productId: existing.id, message: null, priceChanges }
    : { status: "skipped", productId: existing.id, message: "Sin cambios.", priceChanges: 0 };
}

/** Aplica un producto normalizado (crear o actualizar según opciones). */
export async function applyProduct(ctx: ApplyContext, product: NormalizedProduct): Promise<ApplyResult> {
  try {
    const existing = await findExisting(ctx, product);
    if (existing) {
      if (!ctx.options.update_existing) {
        return { status: "skipped", productId: existing.id, message: "Ya existe (la importación no actualiza existentes).", priceChanges: 0 };
      }
      return await updateProduct(ctx, existing, product);
    }
    if (!ctx.options.create_new) {
      return { status: "skipped", productId: null, message: "No existe en la tienda (la importación sólo actualiza).", priceChanges: 0 };
    }
    return await createProduct(ctx, product);
  } catch (err) {
    if (err instanceof ApplyError) return { status: "error", productId: null, message: err.message, priceChanges: 0 };
    throw err;
  }
}

// ---------------------------------------------------------------------------
// CSV: actualizar por SKU
// ---------------------------------------------------------------------------

/** Aplica una fila del CSV de actualización re-evaluando contra la base. */
export async function applyCsvUpdate(ctx: ApplyContext, diff: CsvUpdateDiff): Promise<ApplyResult> {
  const target = diff.target;
  const variantId = diff.variant?.variant_id;
  if (!target || !variantId) return { status: "error", productId: null, message: diff.error ?? "Fila inválida.", priceChanges: 0 };

  try {
    const cur = must(
      await ctx.db
        .from("product_variants")
        .select("id, product_id, price, compare_at_price, cost, stock, products(slug, status, published_at)")
        .eq("id", variantId)
        .maybeSingle(),
      "leer variante",
    );
    const product = Array.isArray(cur.products) ? cur.products[0] : cur.products;
    let changed = 0;
    let priceChanges = 0;

    const nextPrice = target.price ?? cur.price;
    let nextCompare = target.compare_at_price !== undefined ? target.compare_at_price : cur.compare_at_price;
    if (nextCompare !== null && nextCompare <= nextPrice) nextCompare = null;
    const priceMoved = !sameMoney(nextPrice, cur.price) || !sameMoney(nextCompare, cur.compare_at_price);
    const costMoved = target.cost !== undefined && !sameMoney(target.cost, cur.cost);

    if (priceMoved || costMoved) {
      const r = await ctx.db
        .from("product_variants")
        .update({
          price: nextPrice,
          compare_at_price: nextCompare,
          ...(target.cost !== undefined ? { cost: target.cost } : {}),
        })
        .eq("id", cur.id);
      if (r.error) throw new ApplyError(`actualizar precio: ${r.error.message}`);
      if (priceMoved) {
        await logPriceChange(ctx, cur.id, cur, { price: nextPrice, compare_at_price: nextCompare });
        priceChanges += 1;
      }
      changed += 1;
    }

    if (target.stock !== undefined && target.stock !== cur.stock) {
      await adjustStock(ctx, cur.id, target.stock - cur.stock, `CSV ${ctx.csvFileName ?? ""}`.trim());
      changed += 1;
    }

    if (target.status && product && target.status !== product.status) {
      const r = await ctx.db
        .from("products")
        .update({
          status: target.status,
          ...(target.status === "active" && !product.published_at ? { published_at: new Date().toISOString() } : {}),
        })
        .eq("id", cur.product_id);
      if (r.error) throw new ApplyError(`estado: ${r.error.message}`);
      changed += 1;
    }

    if (product?.slug) ctx.touchedSlugs.add(product.slug);
    return changed > 0
      ? { status: "updated", productId: cur.product_id, message: null, priceChanges }
      : { status: "skipped", productId: cur.product_id, message: "Sin cambios.", priceChanges: 0 };
  } catch (err) {
    if (err instanceof ApplyError) return { status: "error", productId: null, message: err.message, priceChanges: 0 };
    throw err;
  }
}
