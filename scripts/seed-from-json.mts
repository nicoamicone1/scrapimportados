/**
 * Importa el catálogo DAZ (`data/products.json`) a Supabase.
 *
 *   SEED_EMAIL=admin@ecommy.local SEED_PASSWORD='…' npm run seed
 *   npm run seed -- --skip-images     # usa las URLs remotas (imagesRemote) sin subir nada
 *   npm run seed -- --force-images    # reemplaza las imágenes de productos que ya tenían
 *
 * Corre como un admin logueado (RLS), sin service-role key. Es idempotente:
 * categorías por `external_id`, productos por (`source`, `external_id`),
 * variantes por (`product_id`, `option_values`). En productos existentes NO
 * pisa el stock (sólo precio, costo y SKU) ni las imágenes (salvo --force-images).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: se usan las variables del entorno.
}

// ---------------------------------------------------------------------------
// Tipos del JSON (ver data/SCHEMA.md)
// ---------------------------------------------------------------------------

interface SourceCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
}

interface SourceProduct {
  id: number;
  sku: string;
  name: string;
  slug: string;
  permalink: string;
  images: string[];
  imagesRemote?: string[];
  categories: { id: number; name: string; slug: string }[];
  inStock: boolean;
  shortDescription: string;
  prices: {
    efectivo: { base: number; final: number };
    web: { base: number; final: number };
  };
  supplierWebPrice?: number;
}

interface SourceFile {
  scrapedAt: string;
  source: string;
  categories: SourceCategory[];
  products: SourceProduct[];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const SKIP_IMAGES = args.has("--skip-images");
const FORCE_IMAGES = args.has("--force-images");
const DEFAULT_STOCK = 10;
const BATCH = 100;
const UPLOAD_CONCURRENCY = 8;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;

if (!url || !anonKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!email || !password) throw new Error("Definí SEED_EMAIL y SEED_PASSWORD (un admin activo)");

const supabase = createClient<Database>(url, anonKey, { auth: { persistSession: false } });

function log(msg: string) {
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

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const auth = await supabase.auth.signInWithPassword({ email: email!, password: password! });
  if (auth.error) throw new Error(`Login falló: ${auth.error.message}`);
  const isAdmin = await supabase.rpc("is_admin");
  if (!isAdmin.data) throw new Error("El usuario no es admin activo");
  log(`Logueado como ${email}`);

  const raw = await readFile(path.join(process.cwd(), "data", "products.json"), "utf8");
  const source = JSON.parse(raw) as SourceFile;
  log(`${source.products.length} productos y ${source.categories.length} categorías en el JSON`);

  // ---------------- Categorías ----------------
  const usable = source.categories.filter((c) => c.name.trim() && c.name.trim() !== "–");
  must(
    await supabase
      .from("categories")
      .upsert(
        usable.map((c, i) => ({
          external_id: String(c.id),
          name: c.name.trim(),
          slug: c.slug,
          position: i,
          is_visible: true,
        })),
        { onConflict: "external_id" },
      )
      .select("id"),
    "upsert categorías",
  );
  const catRows = must(
    await supabase.from("categories").select("id, external_id").not("external_id", "is", null),
    "leer categorías",
  );
  const catByExt = new Map(catRows.map((c) => [c.external_id as string, c.id]));
  // Jerarquía (segunda pasada, cuando ya existen todos los ids).
  for (const c of usable) {
    const parentId = c.parent ? catByExt.get(String(c.parent)) ?? null : null;
    const id = catByExt.get(String(c.id));
    if (!id) continue;
    const r = await supabase.from("categories").update({ parent_id: parentId }).eq("id", id);
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
            name: p.name.trim(),
            slug: p.slug,
            short_description: p.shortDescription?.trim() || null,
            description_html: p.shortDescription?.trim() ? `<p>${escapeHtml(p.shortDescription.trim())}</p>` : null,
            status: "active",
            source: "import",
            source_url: p.permalink,
            external_id: String(p.id),
            published_at: now,
            metadata: { importedFrom: source.source, scrapedAt: source.scrapedAt, prices: p.prices },
          })),
          { onConflict: "source,external_id" },
        )
        .select("id, external_id"),
      "upsert productos",
    );
    for (const r of rows) productIdByExt.set(r.external_id as string, r.id);
    log(`Productos ${Math.min((i + 1) * BATCH, source.products.length)}/${source.products.length}`);
  }

  // ---------------- Variantes ----------------
  const productIds = [...productIdByExt.values()];
  const existingVariants = new Map<string, string>();
  for (const ids of chunk(productIds, 200)) {
    const rows = must(
      await supabase.from("product_variants").select("id, product_id").in("product_id", ids),
      "leer variantes",
    );
    for (const r of rows) existingVariants.set(r.product_id, r.id);
  }

  const toInsert: Database["public"]["Tables"]["product_variants"]["Insert"][] = [];
  let updated = 0;
  for (const p of source.products) {
    const productId = productIdByExt.get(String(p.id));
    if (!productId) continue;
    const common = {
      price: p.prices.web.final,
      cost: p.prices.efectivo.base,
      sku: p.sku || null,
    };
    const variantId = existingVariants.get(productId);
    if (variantId) {
      const r = await supabase.from("product_variants").update(common).eq("id", variantId);
      if (r.error) throw new Error(`variante ${p.name}: ${r.error.message}`);
      updated++;
    } else {
      toInsert.push({
        ...common,
        product_id: productId,
        title: "Default",
        option_values: {},
        compare_at_price: null,
        stock: p.inStock ? DEFAULT_STOCK : 0,
        track_inventory: true,
        position: 0,
      });
    }
  }
  let created = 0;
  for (const batch of chunk(toInsert, BATCH)) {
    const rows = must(
      await supabase.from("product_variants").insert(batch).select("id, stock"),
      "insertar variantes",
    );
    created += rows.length;
    // Movimiento de inventario inicial (trazabilidad del stock importado).
    const movements = rows
      .filter((v) => v.stock !== 0)
      .map((v) => ({ variant_id: v.id, delta: v.stock, stock_after: v.stock, reason: "import", note: "Importación inicial" }));
    if (movements.length) {
      const r = await supabase.from("inventory_movements").insert(movements);
      if (r.error) throw new Error(`movimientos: ${r.error.message}`);
    }
  }
  log(`Variantes: ${created} creadas, ${updated} actualizadas`);

  // ---------------- Producto ↔ categoría ----------------
  const links = source.products.flatMap((p) => {
    const productId = productIdByExt.get(String(p.id));
    if (!productId) return [];
    return p.categories
      .map((c, i) => ({ product_id: productId, category_id: catByExt.get(String(c.id)), position: i }))
      .filter((l): l is { product_id: string; category_id: string; position: number } => !!l.category_id);
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
      await supabase.from("product_images").select("product_id").in("product_id", ids),
      "leer imágenes",
    );
    for (const r of rows) withImages.add(r.product_id);
  }

  const pending = source.products.filter((p) => {
    const id = productIdByExt.get(String(p.id));
    return id && (FORCE_IMAGES || !withImages.has(id));
  });
  log(`Imágenes: ${pending.length} productos por procesar${SKIP_IMAGES ? " (remotas, sin subir)" : ""}`);

  let uploaded = 0;
  let failed = 0;
  await pool(pending, UPLOAD_CONCURRENCY, async (p, index) => {
    const productId = productIdByExt.get(String(p.id))!;
    const urls: string[] = [];

    if (SKIP_IMAGES) {
      urls.push(...(p.imagesRemote ?? []));
    } else {
      for (const local of p.images) {
        const file = path.basename(local);
        try {
          const bytes = await readFile(path.join(process.cwd(), "public", "img", file));
          const storagePath = `products/${productId}/${file}`;
          const up = await supabase.storage.from("media").upload(storagePath, bytes, {
            contentType: file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
          if (up.error) throw new Error(up.error.message);
          urls.push(supabase.storage.from("media").getPublicUrl(storagePath).data.publicUrl);
          uploaded++;
        } catch (err) {
          failed++;
          console.warn(`[seed] No se pudo subir ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (FORCE_IMAGES) {
      const del = await supabase.from("product_images").delete().eq("product_id", productId);
      if (del.error) throw new Error(`borrar imágenes: ${del.error.message}`);
    }
    if (urls.length) {
      const ins = await supabase
        .from("product_images")
        .insert(urls.map((u, i) => ({ product_id: productId, url: u, alt: p.name, position: i })));
      if (ins.error) throw new Error(`insertar imágenes: ${ins.error.message}`);
    }
    if ((index + 1) % 50 === 0) log(`  imágenes ${index + 1}/${pending.length}`);
  });
  log(`Imágenes: ${uploaded} subidas, ${failed} con error`);

  const count = await supabase.from("products").select("id", { count: "exact", head: true });
  log(`Listo. Productos en la base: ${count.count ?? "?"}`);
  await supabase.auth.signOut();
}

main().catch((err: unknown) => {
  console.error(`[seed] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
