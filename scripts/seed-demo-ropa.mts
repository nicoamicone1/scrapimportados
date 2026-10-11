/**
 * Tienda demo pública de Ecommy: «Luna Indumentaria» (marca ficticia, ropa
 * de mujer con talle × color) en la tienda `demo` (https://demo.ecommy.app,
 * el link del CTA de la landing). Pasos y qué verificar: docs/DEMO-ROPA.md.
 *
 *   npm run seed -- --dry-run                       # valida y lista lo que haría, sin tocar la base
 *   SEED_EMAIL=… SEED_PASSWORD=… npm run seed       # = npx tsx scripts/seed-demo-ropa.mts
 *   SEED_EMAIL=… SEED_PASSWORD=… SEED_WHATSAPP=549… npx tsx scripts/seed-demo-ropa.mts --replace
 *
 *   SEED_WHATSAPP=5491122334455 …   # tu WhatsApp, para ver llegar el pedido (sin esto no se pisa el cargado)
 *   SEED_STORE=otra-tienda …        # otro slug (default: demo)
 *   SEED_FILE=data/otro.json …      # otro catálogo con bloque `store` (default: data/demo-ropa.json)
 *   --replace        # BORRA el catálogo que tenga la tienda (productos, variantes, categorías e imágenes) antes de sembrar
 *   --yes            # con --replace, sin la confirmación interactiva
 *   --force-images   # vuelve a generar las imágenes de ejemplo (borra también las fotos subidas desde el panel)
 *
 * 1. Tienda: si no existe la crea con create_store() (rubro "moda": 14 días
 *    de Pro, home, menús y medios de pago; `demo` es un slug reservado y no
 *    se puede crear así: la creó la migración 0011). Si existe, el usuario
 *    tiene que ser dueño o admin, y se renombra al nombre y rubro del JSON.
 * 2. Catálogo ajeno: sin --replace, si la tienda tiene productos (no
 *    archivados) que no son del JSON, frena sin tocar nada. Con --replace los
 *    borra (los que tienen pedidos se archivan), borra las categorías y los
 *    archivos del bucket, y vuelve la identidad a la de una tienda nueva:
 *    scripts/lib/store-replace.mts.
 * 3. Configuración (idempotente): preset del JSON (atelier), WhatsApp (sólo
 *    pisa el cargado con SEED_WHATSAPP), transferencia con su descuento,
 *    umbral de "quedan pocas", zonas de envío y puntos de retiro (por nombre).
 * 4. Catálogo: seedCatalog() de seed-from-json.mts con imágenes de ejemplo
 *    (SVG por color). Re-correrlo (sin --replace) no pisa el stock ni las imágenes.
 *
 * El --dry-run no escribe nunca. Sin SEED_EMAIL/SEED_PASSWORD tampoco se
 * conecta; con ellas se conecta sólo para leer y lista lo que borraría
 * --replace (o por qué frenaría sin él) con los números reales.
 */
import { createInterface } from "node:readline/promises";

import { starterHomeBlocks } from "../src/lib/blocks/starters";
import type { Json } from "../src/lib/supabase/database.types";
import { storeSlugProblem } from "../src/lib/tenant/slug";
import { storeUrl } from "../src/lib/tenant/urls";

import { applySettings, ensureStore, keepPro, parseStoreConfig, printStorePlan, type ParsedStore } from "./lib/store-setup.mjs";
import {
  inspectStore,
  printReplacePlan,
  printReplacePlanOffline,
  renameStore,
  resetIdentity,
  wipeCatalog,
  type StoreInventory,
} from "./lib/store-replace.mjs";
import { cliFlags, connect, findStore, isEntry, loadSource, log, printPlan, seedCatalog, type Db, type SeedStore, type SourceFile } from "./seed-from-json.mjs";

const DEFAULT_FILE = "data/demo-ropa.json";
const DEFAULT_SLUG = "demo";
const DEMO_PRODUCT = "remera-basica-de-algodon";

const sample = (names: string[], n = 8) => `${names.slice(0, n).join(", ")}${names.length > n ? `, … y ${names.length - n} más` : ""}`;

/** Sin --replace: ¿la tienda tiene productos que no son del JSON? Corta antes de escribir nada. */
function assertNoForeign(inv: StoreInventory, slug: string, file: string) {
  if (!inv.foreign.length) return;
  throw new Error(
    [
      `«${slug}» tiene ${inv.foreign.length} productos que no están en ${file} (ej.: ${sample(inv.foreign.map((p) => p.name), 5)}).`,
      "No se tocó nada. Para reemplazar el catálogo entero agregá --replace: BORRA todos los productos, variantes,",
      "categorías e imágenes de la tienda (los que tienen pedidos se archivan). Miralo antes con --dry-run --replace.",
    ].join("\n"),
  );
}

/** Lo que borra --replace es irreversible: se confirma escribiendo el slug (o con --yes). */
async function confirmReplace(slug: string, yes: boolean) {
  if (yes) return;
  if (!process.stdin.isTTY) throw new Error("--replace sin terminal interactiva: agregá --yes para confirmar.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nEsto BORRA el catálogo de «${slug}» y no se puede deshacer. Escribí ${slug} para seguir: `);
  rl.close();
  if (answer.trim().toLowerCase() !== slug) throw new Error("Cancelado: no se tocó nada.");
}

function homeBlocks(parsed: ParsedStore): Json {
  return starterHomeBlocks(parsed.config.preset, {
    storeName: parsed.config.name,
    transferDiscount: parsed.config.transfer.discountPercent,
    whatsapp: true,
  }) as unknown as Json;
}

async function setHome(supabase: Db, store: SeedStore, parsed: ParsedStore) {
  const r = await supabase.from("pages").update({ blocks: homeBlocks(parsed) }).eq("store_id", store.id).eq("slug", "home");
  if (r.error) console.warn(`[seed] Portada de fábrica: ${r.error.message} (queda la de create_store)`);
}

/** --dry-run: plan sin escribir; con credenciales, lee la tienda para los números reales. */
async function dryRun(source: SourceFile, parsed: ParsedStore, opts: { file: string; slug: string; replace: boolean; whatsappNote: string }) {
  printStorePlan(parsed, opts.slug, opts.whatsappNote);
  printPlan(source, { file: opts.file, storeSlug: opts.slug });

  const canConnect = Boolean(process.env.SEED_EMAIL && process.env.SEED_PASSWORD);
  if (!canConnect) {
    log("--dry-run sin SEED_EMAIL/SEED_PASSWORD: no se conecta a la base");
    if (opts.replace) printReplacePlanOffline(opts.slug, parsed);
    else log(`Sin --replace: si «${opts.slug}» ya tiene productos que no son del JSON, frena sin tocar nada (agregá --replace para borrarlos).`);
    return;
  }

  const supabase = await connect();
  try {
    const store = await findStore(supabase, opts.slug);
    if (!store) {
      log(`«${opts.slug}» no existe: se crearía con create_store()${storeSlugProblem(opts.slug) === "reserved" ? " (no: es un slug reservado, ver la migración 0011)" : ""}`);
      return;
    }
    log(`Tienda existente: ${store.name} (${opts.slug}) · se renombraría a «${parsed.config.name}», rubro ${parsed.config.kind}`);
    const inv = await inspectStore(supabase, store, source, parsed, { full: opts.replace });
    if (opts.replace) printReplacePlan(inv, store, parsed);
    else if (inv.foreign.length) {
      log(`Sin --replace FRENARÍA: ${inv.foreign.length} productos no son del JSON (ej.: ${sample(inv.foreign.map((p) => p.name), 5)})`);
    } else log(`Sin --replace: ${inv.products.length} productos en la tienda, todos del JSON o archivados: se actualizan`);
    log("--dry-run: no se escribió nada");
  } finally {
    await supabase.auth.signOut();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const flags = cliFlags(argv);
  const replace = argv.includes("--replace");
  const yes = argv.includes("--yes");
  const file = process.env.SEED_FILE || DEFAULT_FILE;
  const slug = (process.env.SEED_STORE || DEFAULT_SLUG).trim().toLowerCase();
  const whatsappEnv = process.env.SEED_WHATSAPP?.trim() || undefined;

  const source = await loadSource(file);
  const parsed = parseStoreConfig((source as Record<string, unknown>).store, whatsappEnv);

  if (flags.dryRun) {
    await dryRun(source, parsed, {
      file,
      slug,
      replace,
      whatsappNote: whatsappEnv ? "SEED_WHATSAPP" : "placeholder del JSON: sólo se usa si la tienda no tiene uno; definí SEED_WHATSAPP para recibir los pedidos",
    });
    return;
  }

  const supabase = await connect();
  const { store, created } = await ensureStore(
    supabase,
    slug,
    parsed.config,
    storeSlugProblem(slug) === "reserved"
      ? `«${slug}» es un slug reservado: create_store() no lo crea (la tienda \`demo\` la creó la migración 0011). Si existe y no la ves, tu cuenta no es dueña ni admin de plataforma.`
      : undefined,
  );
  log(created ? `Tienda creada: ${store.name} (${slug})` : `Tienda existente: ${store.name} (${slug})`);

  if (!created) {
    const inv = await inspectStore(supabase, store, source, parsed, { full: replace });
    if (replace) {
      printReplacePlan(inv, store, parsed);
      await confirmReplace(slug, yes);
      await wipeCatalog(supabase, store, inv);
      await resetIdentity(supabase, store, parsed, inv, homeBlocks(parsed));
    } else {
      assertNoForeign(inv, slug, file);
    }
    await renameStore(supabase, store, parsed);
  } else {
    await setHome(supabase, store, parsed);
  }

  // El WhatsApp del JSON es un placeholder: sólo pisa uno cargado si viene de SEED_WHATSAPP.
  await applySettings(supabase, store, parsed, { overwriteWhatsapp: Boolean(whatsappEnv) });
  await keepPro(supabase, store);
  await seedCatalog(supabase, store, source, { forceImages: flags.forceImages });
  await supabase.auth.signOut();

  // ROOT_DOMAIN de urls.ts se lee al importar, antes de cargar .env.local: se pasa explícito.
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  log(`Tienda: ${storeUrl({ slug }, "/", root)}`);
  if (source.products.some((p) => p.slug === DEMO_PRODUCT)) log(`Ficha para la demo: ${storeUrl({ slug }, `/producto/${DEMO_PRODUCT}`, root)}`);
  log("Los cambios pueden tardar hasta 5 minutos en verse en la tienda (caché). Siguiente paso: docs/DEMO-ROPA.md");
}

if (isEntry(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(`[seed] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
