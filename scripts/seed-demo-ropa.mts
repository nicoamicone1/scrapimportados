/**
 * Tienda demo de ropa femenina («Luna Indumentaria», marca ficticia) para
 * mostrarle Ecommy a marcas de ropa. Pasos y qué verificar: docs/DEMO-ROPA.md.
 *
 *   SEED_EMAIL=… SEED_PASSWORD=… npx tsx scripts/seed-demo-ropa.mts
 *   SEED_WHATSAPP=5491122334455 …      # tu WhatsApp, para ver llegar el pedido (default: placeholder)
 *   SEED_STORE=otra-tienda …           # otro slug (default: ropa)
 *   SEED_FILE=data/otro.json …         # otro catálogo (default: data/demo-ropa.json)
 *   npx tsx scripts/seed-demo-ropa.mts --dry-run       # valida y lista lo que haría, sin tocar la base
 *   npx tsx scripts/seed-demo-ropa.mts --force-images  # vuelve a generar las imágenes de ejemplo
 *
 * 1. Tienda: si no existe la crea con create_store() (rubro "moda", el mismo
 *    alta que /app/nueva: 14 días de Pro, home, menús y medios de pago); si
 *    existe, el usuario tiene que ser dueño o admin.
 * 2. Configuración (idempotente): preset del JSON (atelier), WhatsApp,
 *    transferencia con su descuento, umbral de "quedan pocas", zonas de envío
 *    y puntos de retiro (por nombre: si ya están, se actualizan).
 * 3. Catálogo: seedCatalog() de seed-from-json.mts con imágenes de ejemplo
 *    (SVG por color). Re-correrlo no pisa el stock ni las imágenes.
 *
 * Los pasos 1 y 2 (y el Pro activo) están en scripts/lib/store-setup.mts,
 * que comparte con scripts/prospect-store.mts.
 */
import { storeUrl } from "../src/lib/tenant/urls";

import { applySettings, ensureStore, keepPro, parseStoreConfig, printStorePlan } from "./lib/store-setup.mjs";
import { cliFlags, connect, isEntry, loadSource, log, printPlan, seedCatalog } from "./seed-from-json.mjs";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const flags = cliFlags();
  const file = process.env.SEED_FILE || "data/demo-ropa.json";
  const slug = (process.env.SEED_STORE || "ropa").trim().toLowerCase();
  const whatsappEnv = process.env.SEED_WHATSAPP?.trim() || undefined;

  const source = await loadSource(file);
  const parsed = parseStoreConfig((source as Record<string, unknown>).store, whatsappEnv);

  if (flags.dryRun) {
    printStorePlan(
      parsed,
      slug,
      whatsappEnv ? "SEED_WHATSAPP" : "placeholder del JSON: definí SEED_WHATSAPP para recibir los pedidos",
    );
    printPlan(source, { file, storeSlug: slug, placeholders: !flags.skipImages });
    return;
  }

  const supabase = await connect();
  const { store, created } = await ensureStore(supabase, slug, parsed.config);
  log(created ? `Tienda creada: ${store.name} (${slug})` : `Tienda existente: ${store.name} (${slug})`);
  // El WhatsApp del JSON es un placeholder: sólo pisa uno cargado si viene de SEED_WHATSAPP.
  await applySettings(supabase, store, parsed, { overwriteWhatsapp: Boolean(whatsappEnv) });
  await keepPro(supabase, store);
  await seedCatalog(supabase, store, source, { ...flags, placeholders: true });
  await supabase.auth.signOut();

  // ROOT_DOMAIN de urls.ts se lee al importar, antes de cargar .env.local: se pasa explícito.
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  log(`Tienda: ${storeUrl({ slug }, "/", root)}`);
  log(`Ficha para la demo: ${storeUrl({ slug }, "/producto/remera-basica-de-algodon", root)}`);
  log("Los cambios pueden tardar hasta 5 minutos en verse en la tienda (caché). Siguiente paso: docs/DEMO-ROPA.md");
}

if (isEntry(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(`[seed] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
