/**
 * Reemplazo del catálogo de una tienda existente (`--replace` de
 * scripts/seed-demo-ropa.mts): la deja como recién creada para el JSON
 * nuevo. Se pensó para pasar la tienda `demo` del catálogo de electro a la
 * demo de ropa, una sola vez, con un admin de la tienda (o de plataforma).
 *
 * Qué hace, en este orden (todo con RLS, sin service-role):
 *
 * 1. Productos: los que tienen pedidos se ARCHIVAN (el panel tampoco deja
 *    borrarlos: `deleteProduct` pide conservar el historial). Se les libera
 *    el slug (`<slug>-archivado-<id>`) y el `external_id` para que no choquen
 *    con los del JSON, y se borran sus imágenes. El resto se BORRA: las
 *    variantes, imágenes, categorías del producto, movimientos de stock,
 *    avisos de stock y cambios de precio caen en cascada (migraciones 0001,
 *    0016, 0022); en pedidos e importaciones queda `product_id` en null.
 * 2. Categorías: se borran todas (product_categories en cascada).
 * 3. Bucket `media`: se borra todo lo que está bajo `<store_id>/` salvo
 *    `receipts/` (comprobantes de pago de pedidos).
 * 4. Identidad: nombre, rubro, bajada, SEO, banda de anuncio, redes, logo,
 *    favicon, encabezado/pie, políticas, datos fiscales y datos de la cuenta
 *    para transferencias vuelven a los de una tienda nueva; menús y portada
 *    de fábrica del preset; las demás páginas pasan a borrador; promociones
 *    desactivadas; redirecciones borradas; zonas de envío, retiros y medios de
 *    pago que no son del JSON, desactivados (los pedidos viejos los referencian).
 *
 * `inspectStore()` sólo lee: lo usan el --dry-run (si hay credenciales) y la
 * corrida real antes de borrar.
 */
import type { Json } from "../../src/lib/supabase/database.types";

import { log, must, type Db, type SeedStore, type SourceFile } from "../seed-from-json.mjs";

import type { ParsedStore } from "./store-setup.mjs";

const PAGE = 1000;
const ID_CHUNK = 100;
/** Carpetas del bucket que no se tocan: comprobantes de pago de los pedidos. */
const KEEP_MEDIA = ["receipts"];
/** Medios de pago que configura el seed (los demás se desactivan con --replace). */
const SEED_PAYMENT_TYPES = ["transfer", "whatsapp"];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Todas las filas de una consulta, de a 1000 (el tope de PostgREST). */
async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = must(await page(from, from + PAGE - 1), what);
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Archivos del bucket bajo `prefix` (recursivo; las "carpetas" vienen con id null), salvo las carpetas de `skip`. */
async function listMedia(supabase: Db, prefix: string, skip: string[] = []): Promise<string[]> {
  const bucket = supabase.storage.from("media");
  const out: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`listar media/${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      if (skip.includes(entry.name)) continue;
      const full = `${prefix}/${entry.name}`;
      if (entry.id === null) out.push(...(await listMedia(supabase, full)));
      else out.push(full);
    }
    if (!data || data.length < PAGE) return out;
  }
}

const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string) => {
  const r = await q;
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.count ?? 0;
};

// ---------------------------------------------------------------------------
// Inspección (sólo lee)
// ---------------------------------------------------------------------------

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  source: string;
  external_id: string | null;
}

export interface StoreInventory {
  products: ProductRow[];
  /** Productos no archivados que no son del JSON (sin --replace, el seed frena). */
  foreign: ProductRow[];
  /** Productos con pedidos: se archivan en vez de borrarse. */
  withOrders: Set<string>;
  variants: number;
  categories: number;
  images: number;
  /** Sólo con `full`: lo demás que toca --replace. */
  full: null | {
    media: string[];
    settings: { name: string; tagline: string | null; logo: boolean; announcement: string; contactEmail: string | null; contactPhone: string | null };
    pages: { id: string; title: string; slug: string; status: string }[];
    promotions: number;
    redirects: number;
    zones: string[];
    pickups: string[];
    methods: string[];
  };
}

/** ¿El producto de la base es uno del JSON? (mismo criterio que el upsert de seedCatalog). */
function jsonIds(source: SourceFile): Set<string> {
  return new Set(source.products.map((p) => String(p.id)));
}

export async function inspectStore(
  supabase: Db,
  store: SeedStore,
  source: SourceFile,
  parsed: ParsedStore,
  opts: { full: boolean },
): Promise<StoreInventory> {
  const storeId = store.id;
  const products = await selectAll<ProductRow>(
    (from, to) =>
      supabase.from("products").select("id, name, slug, status, source, external_id").eq("store_id", storeId).order("name").range(from, to),
    "leer productos",
  );
  const ids = jsonIds(source);
  const foreign = products.filter((p) => p.status !== "archived" && !(p.source === "import" && p.external_id && ids.has(p.external_id)));

  const ordered = await selectAll<{ product_id: string | null }>(
    (from, to) => supabase.from("order_items").select("product_id").eq("store_id", storeId).not("product_id", "is", null).range(from, to),
    "leer ítems de pedidos",
  );
  const withOrders = new Set(ordered.flatMap((o) => (o.product_id ? [o.product_id] : [])));

  const [variants, categories, images] = await Promise.all([
    count(supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("store_id", storeId), "contar variantes"),
    count(supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", storeId), "contar categorías"),
    count(supabase.from("product_images").select("id", { count: "exact", head: true }).eq("store_id", storeId), "contar imágenes"),
  ]);

  if (!opts.full) return { products, foreign, withOrders, variants, categories, images, full: null };

  const media = await listMedia(supabase, storeId, KEEP_MEDIA);

  const settingsRead = await supabase
    .from("store_settings")
    .select("name, tagline, logo_url, announcement, contact_email, contact_phone")
    .eq("store_id", storeId)
    .single();
  if (settingsRead.error) throw new Error(`leer configuración: ${settingsRead.error.message}`);
  const settings = settingsRead.data;
  const pages = must(
    await supabase.from("pages").select("id, title, slug, status").eq("store_id", storeId).order("slug"),
    "leer páginas",
  );
  const zoneNames = new Set(parsed.zones.map((z) => z.name));
  const pickupNames = new Set(parsed.pickups.map((p) => p.name));
  const [promotions, redirects, zones, pickups, methods] = await Promise.all([
    count(supabase.from("promotions").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("is_active", true), "contar promociones"),
    count(supabase.from("redirects").select("id", { count: "exact", head: true }).eq("store_id", storeId), "contar redirecciones"),
    supabase.from("shipping_zones").select("name").eq("store_id", storeId).eq("is_active", true),
    supabase.from("pickup_locations").select("name").eq("store_id", storeId).eq("is_active", true),
    supabase.from("payment_methods").select("name, type").eq("store_id", storeId).eq("is_active", true),
  ]);

  return {
    products,
    foreign,
    withOrders,
    variants,
    categories,
    images,
    full: {
      media,
      settings: {
        name: settings.name,
        tagline: settings.tagline,
        logo: Boolean(settings.logo_url),
        announcement: String(obj(settings.announcement).text ?? ""),
        contactEmail: settings.contact_email,
        contactPhone: settings.contact_phone,
      },
      pages,
      promotions,
      redirects,
      zones: must(zones, "leer zonas de envío").map((z) => z.name).filter((n) => !zoneNames.has(n)),
      pickups: must(pickups, "leer puntos de retiro").map((p) => p.name).filter((n) => !pickupNames.has(n)),
      methods: must(methods, "leer medios de pago").filter((m) => !SEED_PAYMENT_TYPES.includes(m.type)).map((m) => m.name),
    },
  };
}

const sample = (names: string[], n = 8) => `${names.slice(0, n).join(", ")}${names.length > n ? `, … y ${names.length - n} más` : ""}`;

/** Lo que borraría o cambiaría --replace, con los números de la base. */
export function printReplacePlan(inv: StoreInventory, store: SeedStore, parsed: ParsedStore) {
  const archive = inv.products.filter((p) => inv.withOrders.has(p.id));
  log(`--replace en «${store.slug}» (${store.name}): esto se borra o se cambia ANTES de sembrar`);
  console.info(`    Productos: ${inv.products.length} (${inv.products.length - archive.length} se borran, ${archive.length} con pedidos se archivan)`);
  if (inv.products.length) console.info(`      ej.: ${sample(inv.products.map((p) => p.name))}`);
  if (archive.length) console.info(`      se archivan (tienen pedidos): ${sample(archive.map((p) => p.name))}`);
  console.info(`    Variantes: ${inv.variants} · Imágenes de productos: ${inv.images} · Categorías: ${inv.categories}`);
  if (!inv.full) return;
  const f = inv.full;
  console.info(`    Archivos del bucket media/${store.slug} (${store.id}/…, sin receipts/): ${f.media.length}`);
  console.info(
    `    Nombre: «${f.settings.name}» → «${parsed.config.name}» · rubro → ${parsed.config.kind} · preset → ${parsed.config.preset}`,
  );
  console.info(
    `    Bajada, SEO, anuncio${f.settings.announcement ? ` («${f.settings.announcement}»)` : ""}, redes, ${f.settings.logo ? "logo, " : ""}favicon, encabezado/pie, políticas, datos fiscales y cuenta de transferencia: los de una tienda nueva + el JSON`,
  );
  console.info(`    Menús y portada: los de fábrica del preset ${parsed.config.preset}`);
  const others = f.pages.filter((p) => p.slug !== "home" && p.status === "published");
  console.info(`    Páginas publicadas que pasan a borrador: ${others.length ? sample(others.map((p) => p.title)) : "ninguna"}`);
  console.info(`    Promociones activas que se desactivan: ${f.promotions} · Redirecciones que se borran: ${f.redirects}`);
  console.info(`    Zonas de envío que se desactivan: ${f.zones.length ? sample(f.zones) : "ninguna"}`);
  console.info(`    Puntos de retiro que se desactivan: ${f.pickups.length ? sample(f.pickups) : "ninguno"}`);
  console.info(`    Medios de pago que se desactivan: ${f.methods.length ? sample(f.methods) : "ninguno"}`);
  console.info(
    `    No se tocan: pedidos, clientes, cupones, equipo, plan, dominio, mail y teléfono de contacto (${f.settings.contactEmail || "sin mail"} · ${f.settings.contactPhone || "sin teléfono"})`,
  );
}

/** Lo que haría --replace cuando el --dry-run no se conecta (sin credenciales). */
export function printReplacePlanOffline(slug: string, parsed: ParsedStore) {
  log(`--replace en «${slug}»: si la tienda existe, ANTES de sembrar`);
  console.info("    · BORRA todos sus productos, variantes, imágenes y categorías (los productos con pedidos se archivan)");
  console.info(`    · BORRA los archivos del bucket media/<store_id>/ (salvo receipts/, los comprobantes de pedidos)`);
  console.info(`    · la renombra a «${parsed.config.name}», rubro ${parsed.config.kind}, preset ${parsed.config.preset}`);
  console.info("    · bajada, SEO, anuncio, redes, logo, encabezado/pie, políticas, datos fiscales y cuenta de transferencia: los de una tienda nueva + el JSON");
  console.info("    · menús y portada de fábrica; otras páginas a borrador; promociones desactivadas; redirecciones borradas");
  console.info("    · zonas de envío, retiros y medios de pago que no son del JSON: desactivados");
  console.info("    · no toca pedidos, clientes, cupones, equipo, plan ni dominio");
  console.info("    --dry-run sin SEED_EMAIL/SEED_PASSWORD no se conecta: no sabe cuántos productos hay. Con las credenciales,");
  console.info("    el mismo --dry-run --replace se conecta SÓLO PARA LEER y lista los números reales.");
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/** Pasos 1 a 3: catálogo y archivos. */
export async function wipeCatalog(supabase: Db, store: SeedStore, inv: StoreInventory) {
  const storeId = store.id;
  const archive = inv.products.filter((p) => inv.withOrders.has(p.id));
  const remove = inv.products.filter((p) => !inv.withOrders.has(p.id));

  for (const p of archive) {
    const r = await supabase
      .from("products")
      .update({
        status: "archived",
        featured: false,
        related_ids: [],
        external_id: null,
        slug: p.slug.includes("-archivado-") ? p.slug : `${p.slug}-archivado-${p.id.slice(0, 8)}`,
      })
      .eq("store_id", storeId)
      .eq("id", p.id);
    if (r.error) throw new Error(`archivar ${p.name}: ${r.error.message}`);
  }
  for (const ids of chunk(archive.map((p) => p.id), ID_CHUNK)) {
    const r = await supabase.from("product_images").delete().eq("store_id", storeId).in("product_id", ids);
    if (r.error) throw new Error(`imágenes de archivados: ${r.error.message}`);
  }
  if (archive.length) log(`Archivados (tienen pedidos): ${archive.length}`);

  let deleted = 0;
  for (const ids of chunk(remove.map((p) => p.id), ID_CHUNK)) {
    const r = await supabase.from("products").delete().eq("store_id", storeId).in("id", ids);
    if (r.error) throw new Error(`borrar productos: ${r.error.message}`);
    deleted += ids.length;
    if (deleted % 500 === 0) log(`  borrados ${deleted}/${remove.length}`);
  }
  log(`Productos borrados: ${deleted} (con sus variantes, imágenes y movimientos de stock)`);

  const cats = await supabase.from("categories").delete().eq("store_id", storeId);
  if (cats.error) throw new Error(`borrar categorías: ${cats.error.message}`);

  // RLS no da error si no deja borrar: filtra las filas. Se verifica antes de sembrar.
  const [left, leftCats] = await Promise.all([
    count(supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).neq("status", "archived"), "contar productos"),
    count(supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", storeId), "contar categorías"),
  ]);
  if (left || leftCats) {
    throw new Error(`quedaron ${left} productos y ${leftCats} categorías sin borrar: ¿${process.env.SEED_EMAIL} es admin activo de «${store.slug}»?`);
  }
  log(`Categorías borradas: ${inv.categories}`);

  const media = inv.full?.media ?? [];
  let removed = 0;
  for (const paths of chunk(media, ID_CHUNK)) {
    const r = await supabase.storage.from("media").remove(paths);
    if (r.error) throw new Error(`borrar archivos: ${r.error.message}`);
    removed += r.data?.length ?? 0;
  }
  log(`Archivos del bucket borrados: ${removed}/${media.length}`);
}

const MENUS: { handle: string; items: Json }[] = [
  {
    handle: "header",
    items: [
      { label: "Inicio", href: "/", children: [] },
      { label: "Productos", href: "/productos", children: [] },
      { label: "Cómo comprar", href: "/#como-comprar", children: [] },
    ],
  },
  {
    handle: "footer",
    items: [
      {
        label: "Tienda",
        href: "/productos",
        children: [
          { label: "Todos los productos", href: "/productos", children: [] },
          { label: "Carrito", href: "/carrito", children: [] },
        ],
      },
      { label: "Ayuda", href: "/#como-comprar", children: [{ label: "Cómo comprar", href: "/#como-comprar", children: [] }] },
    ],
  },
];

const pct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/**
 * Paso 4: identidad de una tienda nueva (lo que siembra create_store), antes
 * de applySettings(), que después carga el bloque `store` del JSON.
 * `home`: bloques de la portada de fábrica del preset.
 */
export async function resetIdentity(supabase: Db, store: SeedStore, parsed: ParsedStore, inv: StoreInventory, home: Json) {
  const storeId = store.id;
  const { config } = parsed;

  const read = await supabase.from("store_settings").select("checkout, legal").eq("store_id", storeId).single();
  if (read.error) throw new Error(`leer configuración: ${read.error.message}`);
  const checkout = obj(read.data.checkout);
  const legal = obj(read.data.legal);
  const discount = config.transfer.discountPercent;
  const settings = await supabase
    .from("store_settings")
    .update({
      tagline: null,
      logo_url: null,
      favicon_url: null,
      address: [config.city, config.province].filter(Boolean).join(", ") || null,
      social: { instagram: "", facebook: "", tiktok: "", x: "", youtube: "" },
      seo: { title: config.name, description: config.tagline, og_image_url: "" },
      announcement:
        discount > 0
          ? { enabled: true, text: `${pct(discount)} % de descuento pagando por transferencia`, href: "/productos", bg: "", fg: "" }
          : { enabled: false, text: "", href: "", bg: "", fg: "" },
      header: {},
      footer: {},
      policies: { shipping_md: "", returns_md: "", privacy_md: "", terms_md: "" },
      legal: { ...legal, cuit: null, razon_social: null, data_fiscal: { image_url: null, href: null } } as Json,
      // applySettings() completa banco, titular y alias con los del JSON.
      checkout: { ...checkout, transfer: { ...obj(checkout.transfer), bank_name: "", holder: "", alias: "", cbu: "", cuit: "" } } as Json,
    })
    .eq("store_id", storeId);
  if (settings.error) throw new Error(`configuración: ${settings.error.message}`);

  for (const m of MENUS) {
    const r = await supabase.from("menus").upsert({ store_id: storeId, handle: m.handle, items: m.items }, { onConflict: "store_id,handle" });
    if (r.error) throw new Error(`menú ${m.handle}: ${r.error.message}`);
  }

  const pages = inv.full?.pages ?? [];
  const homePage = pages.find((p) => p.slug === "home");
  if (homePage) {
    const r = await supabase.from("pages").update({ blocks: home, status: "published" }).eq("store_id", storeId).eq("id", homePage.id);
    if (r.error) throw new Error(`portada: ${r.error.message}`);
    const d = await supabase.from("page_drafts").delete().eq("store_id", storeId).eq("page_id", homePage.id);
    if (d.error) throw new Error(`borrador de la portada: ${d.error.message}`);
  } else {
    const r = await supabase.from("pages").insert({
      store_id: storeId,
      title: "Inicio",
      slug: "home",
      type: "home",
      status: "published",
      blocks: home,
      seo: { title: "", description: "" },
      published_at: new Date().toISOString(),
      show_in_menu: false,
    });
    if (r.error) throw new Error(`portada: ${r.error.message}`);
  }
  const others = pages.filter((p) => p.slug !== "home" && p.status === "published").map((p) => p.id);
  if (others.length) {
    const r = await supabase.from("pages").update({ status: "draft" }).eq("store_id", storeId).in("id", others);
    if (r.error) throw new Error(`páginas: ${r.error.message}`);
  }

  const promos = await supabase.from("promotions").update({ is_active: false }).eq("store_id", storeId).eq("is_active", true);
  if (promos.error) throw new Error(`promociones: ${promos.error.message}`);
  const redirects = await supabase.from("redirects").delete().eq("store_id", storeId);
  if (redirects.error) throw new Error(`redirecciones: ${redirects.error.message}`);

  const f = inv.full;
  if (f?.zones.length) {
    const r = await supabase.from("shipping_zones").update({ is_active: false }).eq("store_id", storeId).in("name", f.zones);
    if (r.error) throw new Error(`zonas de envío: ${r.error.message}`);
  }
  if (f?.pickups.length) {
    const r = await supabase.from("pickup_locations").update({ is_active: false }).eq("store_id", storeId).in("name", f.pickups);
    if (r.error) throw new Error(`puntos de retiro: ${r.error.message}`);
  }
  const methods = await supabase
    .from("payment_methods")
    .update({ is_active: false })
    .eq("store_id", storeId)
    .not("type", "in", `(${SEED_PAYMENT_TYPES.join(",")})`);
  if (methods.error) throw new Error(`medios de pago: ${methods.error.message}`);

  log(
    `Identidad de tienda nueva: menús y portada de fábrica, ${others.length} páginas a borrador, ${f?.promotions ?? 0} promociones desactivadas, ${f?.redirects ?? 0} redirecciones borradas`,
  );
}

/** Nombre y rubro de una tienda existente (stores + store_settings). */
export async function renameStore(supabase: Db, store: SeedStore, parsed: ParsedStore) {
  const { config } = parsed;
  const current = await supabase.from("stores").select("onboarding").eq("id", store.id).single();
  if (current.error) throw new Error(`leer tienda: ${current.error.message}`);
  const r = await supabase
    .from("stores")
    .update({ name: config.name, onboarding: { ...obj(current.data.onboarding), kind: config.kind } as Json })
    .eq("id", store.id);
  if (r.error) throw new Error(`renombrar tienda: ${r.error.message}`);
  const s = await supabase.from("store_settings").update({ name: config.name }).eq("store_id", store.id);
  if (s.error) throw new Error(`nombre en la configuración: ${s.error.message}`);
  if (store.name !== config.name) log(`Tienda renombrada: «${store.name}» → «${config.name}» (rubro ${config.kind})`);
  store.name = config.name;
}
