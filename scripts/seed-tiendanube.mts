/**
 * Importa a una tienda de Ecommy el JSON que genera `scripts/scrape-tiendanube.mjs`
 * (demo de un cliente que hoy vende en Tiendanube).
 *
 *   SEED_EMAIL=… SEED_PASSWORD=… SEED_STORE=ramas SEED_FILE=data/clients/ramas.json \
 *     npx tsx scripts/seed-tiendanube.mts
 *
 * Igual que `seed-from-json.mts`: corre como un usuario logueado (RLS, sin
 * service role) que es dueño o admin de `SEED_STORE`, y es idempotente dentro de
 * la tienda (categorías por `external_id`, productos por `source`+`external_id`,
 * variantes por `option_values`; las imágenes se suben sólo a productos que no
 * tienen). Diferencias con el catálogo DAZ:
 *
 * - Precios del cliente tal cual (sin markup ni costo).
 * - Variantes y opciones reales (Tamaño, Color…); si Tiendanube no controla
 *   stock (`stock: null`), la variante queda sin control de inventario.
 * - Descripción HTML completa y `featured` para lo que el cliente destaca en su home.
 * - Las fotos se bajan del CDN de Tiendanube y se suben a
 *   `media/<store_id>/products/<productId>/…`; el logo, a `media/<store_id>/brand/`
 *   (y se usa como logo de la tienda si todavía no tiene uno).
 * - Sólo se crean las categorías con productos (propios o de sus subcategorías).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { MEDIA_BUCKET, mediaPath } from "../src/lib/media";
import type { Database, Json } from "../src/lib/supabase/database.types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: se usan las variables del entorno.
}

interface TnCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
}

interface TnVariant {
  id: number;
  sku: string | null;
  price: number | null;
  compareAtPrice: number | null;
  stock: number | null;
  available: boolean;
  values: string[];
  image: string | null;
}

interface TnProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  imagesRemote: string[];
  categories: { id: number }[];
  featured?: boolean;
  shortDescription: string;
  descriptionHtml: string;
  weightKg: number | null;
  prices: { web: { final: number } };
  options: string[];
  variants: TnVariant[];
}

interface TnFile {
  scrapedAt: string;
  source: string;
  store: { name: string | null; logo: string | null };
  categories: TnCategory[];
  products: TnProduct[];
}

const BATCH = 100;
const UPLOAD_CONCURRENCY = 6;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
const storeSlug = (process.env.SEED_STORE ?? "").trim().toLowerCase();
const file = process.env.SEED_FILE;

if (!url || !anonKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!email || !password) throw new Error("Definí SEED_EMAIL y SEED_PASSWORD (dueño o admin de la tienda)");
if (!storeSlug || !file) throw new Error("Definí SEED_STORE (slug) y SEED_FILE (JSON de scrape-tiendanube.mjs)");

const supabase = createClient<Database>(url, anonKey, { auth: { persistSession: false } });

function log(msg: string) {
  console.info(`[seed-tn] ${msg}`);
}

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: sin datos`);
  return result.data;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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

/** ¿`shortDescription` es un recorte de la descripción (y no la descripción entera)? */
function isTruncated(p: TnProduct): boolean {
  if (!p.shortDescription) return false;
  const full = p.descriptionHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return full.length > p.shortDescription.length + 1;
}

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

/** Baja una imagen remota y la sube al bucket. Devuelve la URL pública. */
async function mirror(remote: string, storagePath: string): Promise<string> {
  const res = await fetch(remote);
  if (!res.ok) throw new Error(`HTTP ${res.status} bajando ${remote}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const ext = path.extname(new URL(remote).pathname).toLowerCase();
  const up = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: res.headers.get("content-type") ?? CONTENT_TYPES[ext] ?? "application/octet-stream",
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) throw new Error(up.error.message);
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function main() {
  const auth = await supabase.auth.signInWithPassword({ email: email!, password: password! });
  if (auth.error) throw new Error(`Login falló: ${auth.error.message}`);

  const found = await supabase.from("stores").select("id, name").eq("slug", storeSlug).maybeSingle();
  if (found.error) throw new Error(`Leer tienda: ${found.error.message}`);
  const store = found.data;
  if (!store) throw new Error(`No existe la tienda «${storeSlug}» (o no sos miembro)`);
  const storeId = store.id;
  const isAdmin = await supabase.rpc("is_store_admin", { p_store_id: storeId });
  if (!isAdmin.data) throw new Error(`${email} no es dueño ni admin activo de «${storeSlug}»`);
  log(`Tienda destino: ${store.name} (${storeSlug} · ${storeId})`);

  const source = JSON.parse(await readFile(path.resolve(file!), "utf8")) as TnFile;
  log(`${source.products.length} productos y ${source.categories.length} categorías en ${file}`);

  // ---------------- Logo ----------------
  if (source.store.logo) {
    const settings = await supabase.from("store_settings").select("logo_url").eq("store_id", storeId).single();
    if (settings.error) throw new Error(`leer configuración: ${settings.error.message}`);
    if (!settings.data.logo_url) {
      const ext = path.extname(new URL(source.store.logo).pathname) || ".png";
      const logoUrl = await mirror(source.store.logo, mediaPath(storeId, "brand", `logo${ext}`));
      const r = await supabase.from("store_settings").update({ logo_url: logoUrl }).eq("store_id", storeId);
      if (r.error) throw new Error(`logo: ${r.error.message}`);
      log(`Logo: ${logoUrl}`);
    }
  }

  // ---------------- Categorías (sólo las que tienen productos) ----------------
  const used = new Set(source.products.flatMap((p) => p.categories.map((c) => c.id)));
  const byId = new Map(source.categories.map((c) => [c.id, c]));
  for (const id of [...used]) {
    for (let c = byId.get(id); c?.parent; c = byId.get(c.parent)) used.add(c.parent);
  }
  const usable = source.categories.filter((c) => used.has(c.id));
  // Tiendanube permite slugs repetidos en ramas distintas (ej. "brainrot"): acá son únicos por tienda.
  const slugs = new Set<string>();
  const catSlug = (c: TnCategory) => {
    let slug = c.slug;
    for (let n = 2; slugs.has(slug); n++) slug = `${c.slug}-${n}`;
    slugs.add(slug);
    return slug;
  };
  must(
    await supabase
      .from("categories")
      .upsert(
        usable.map((c, i) => ({
          store_id: storeId,
          external_id: `tn-${c.id}`,
          name: c.name.trim(),
          slug: catSlug(c),
          position: i,
          is_visible: true,
        })),
        { onConflict: "store_id,external_id" },
      )
      .select("id"),
    "upsert categorías",
  );
  const catRows = must(
    await supabase.from("categories").select("id, external_id").eq("store_id", storeId).like("external_id", "tn-%"),
    "leer categorías",
  );
  const catByExt = new Map(catRows.map((c) => [c.external_id as string, c.id]));
  for (const c of usable) {
    const id = catByExt.get(`tn-${c.id}`);
    const parentId = c.parent ? catByExt.get(`tn-${c.parent}`) ?? null : null;
    if (!id) continue;
    const r = await supabase.from("categories").update({ parent_id: parentId }).eq("store_id", storeId).eq("id", id);
    if (r.error) throw new Error(`jerarquía ${c.name}: ${r.error.message}`);
  }
  log(`Categorías: ${usable.length} de ${source.categories.length} (las vacías no se crean)`);

  // ---------------- Productos ----------------
  const now = new Date().toISOString();
  const productIdByExt = new Map<string, string>();
  for (const batch of chunk(source.products, BATCH)) {
    const rows = must(
      await supabase
        .from("products")
        .upsert(
          batch.map((p) => {
            const options = p.options.map((name, i) => ({
              name,
              values: [...new Set(p.variants.map((v) => v.values[i]).filter(Boolean))],
            }));
            return {
              store_id: storeId,
              name: p.name.trim(),
              slug: p.slug,
              // Si la descripción entra entera en la corta, la ficha la mostraría dos veces.
              short_description: isTruncated(p) ? p.shortDescription : null,
              description_html: p.descriptionHtml || null,
              status: "active",
              featured: !!p.featured,
              options: options as unknown as Json,
              source: "import",
              source_url: p.permalink,
              external_id: `tn-${p.id}`,
              published_at: now,
              metadata: { importedFrom: source.source, scrapedAt: source.scrapedAt, platform: "tiendanube" },
            };
          }),
          { onConflict: "store_id,source,external_id" },
        )
        .select("id, external_id"),
      "upsert productos",
    );
    for (const r of rows) productIdByExt.set(r.external_id as string, r.id);
  }
  log(`Productos: ${productIdByExt.size}`);

  // ---------------- Variantes ----------------
  const productIds = [...productIdByExt.values()];
  const withVariants = new Set<string>();
  for (const ids of chunk(productIds, 200)) {
    const rows = must(
      await supabase.from("product_variants").select("product_id").eq("store_id", storeId).in("product_id", ids),
      "leer variantes",
    );
    for (const r of rows) withVariants.add(r.product_id);
  }
  const toInsert: Database["public"]["Tables"]["product_variants"]["Insert"][] = [];
  for (const p of source.products) {
    const productId = productIdByExt.get(`tn-${p.id}`);
    if (!productId || withVariants.has(productId)) continue;
    const variants = p.variants.length ? p.variants : [null];
    variants.forEach((v, i) => {
      const values = p.options.length && v ? v.values : [];
      const price = v?.price ?? p.prices.web.final;
      const tracked = v?.stock != null;
      toInsert.push({
        store_id: storeId,
        product_id: productId,
        title: values.length ? values.join(" / ") : "Default",
        option_values: Object.fromEntries(p.options.map((name, j) => [name, values[j]]).filter(([, x]) => x)),
        sku: v?.sku || null,
        price,
        compare_at_price: v?.compareAtPrice && v.compareAtPrice > price ? v.compareAtPrice : null,
        stock: tracked ? Math.max(0, v!.stock!) : 0,
        track_inventory: tracked,
        weight_grams: p.weightKg ? Math.round(p.weightKg * 1000) : null,
        is_active: v ? v.available || tracked : true,
        position: i,
      });
    });
  }
  let created = 0;
  for (const batch of chunk(toInsert, BATCH)) {
    const rows = must(await supabase.from("product_variants").insert(batch).select("id"), "insertar variantes");
    created += rows.length;
  }
  log(`Variantes: ${created} creadas (${withVariants.size} productos ya tenían)`);

  // ---------------- Producto ↔ categoría ----------------
  const links = source.products.flatMap((p) => {
    const productId = productIdByExt.get(`tn-${p.id}`);
    if (!productId) return [];
    return p.categories.flatMap((c, i) => {
      const categoryId = catByExt.get(`tn-${c.id}`);
      return categoryId ? [{ store_id: storeId, product_id: productId, category_id: categoryId, position: i }] : [];
    });
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
    const id = productIdByExt.get(`tn-${p.id}`);
    return id && !withImages.has(id);
  });
  let uploaded = 0;
  let failed = 0;
  await pool(pending, UPLOAD_CONCURRENCY, async (p) => {
    const productId = productIdByExt.get(`tn-${p.id}`)!;
    // Fotos de la galería más las de variantes que no estén en la galería.
    const remotes = [...new Set([...p.imagesRemote, ...p.variants.map((v) => v.image).filter((x): x is string => !!x)])];
    const rows: { remote: string; url: string }[] = [];
    for (const remote of remotes) {
      try {
        const name = path.basename(new URL(remote).pathname);
        rows.push({ remote, url: await mirror(remote, mediaPath(storeId, "products", productId, name)) });
        uploaded++;
      } catch (err) {
        failed++;
        console.warn(`[seed-tn] No se pudo subir ${remote}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (!rows.length) return;
    const images = must(
      await supabase
        .from("product_images")
        .insert(rows.map((r, i) => ({ store_id: storeId, product_id: productId, url: r.url, alt: p.name, position: i })))
        .select("id, url"),
      "insertar imágenes",
    );
    // Foto propia de cada variante (ej. el color).
    if (p.variants.length > 1 && p.options.length) {
      for (const v of p.variants) {
        const url = rows.find((r) => r.remote === v.image)?.url;
        const imageId = images.find((img) => img.url === url)?.id;
        if (!imageId) continue;
        const title = v.values.join(" / ");
        const r = await supabase
          .from("product_variants")
          .update({ image_id: imageId })
          .eq("store_id", storeId)
          .eq("product_id", productId)
          .eq("title", title);
        if (r.error) throw new Error(`foto de variante ${p.name} ${title}: ${r.error.message}`);
      }
    }
  });
  log(`Imágenes: ${uploaded} subidas, ${failed} con error`);

  const count = await supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId);
  log(`Listo. Productos en «${storeSlug}»: ${count.count ?? "?"}`);
  await supabase.auth.signOut();
}

main().catch((err: unknown) => {
  console.error(`[seed-tn] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
