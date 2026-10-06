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
 */
import { z } from "zod";

import { isValidE164, normalizePhone } from "../src/lib/schemas/settings";
import { pickupLocationSchema, shippingZoneSchema } from "../src/lib/schemas/shipping";
import type { Json } from "../src/lib/supabase/database.types";
import { storeUrl } from "../src/lib/tenant/urls";
import { PRESETS } from "../src/lib/theme/presets";

import {
  cliFlags,
  connect,
  findStore,
  isEntry,
  loadSource,
  log,
  money,
  must,
  printPlan,
  seedCatalog,
  type Db,
  type SeedStore,
} from "./seed-from-json.mjs";

// ---------------------------------------------------------------------------
// Bloque `store` del JSON
// ---------------------------------------------------------------------------

const storeConfigSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(140).default(""),
  /** Rubro del alta (create_store): "moda" → preset atelier. */
  kind: z.string().default("moda"),
  preset: z.string().refine((id) => Object.hasOwn(PRESETS, id), "Preset desconocido (ver src/lib/theme/presets.ts)."),
  whatsapp: z.string().transform(normalizePhone).refine(isValidE164, "WhatsApp con código de país y área, sin 0 ni 15."),
  lowStockThreshold: z.number().int().min(0).max(100).default(3),
  transfer: z.object({
    discountPercent: z.number().min(0).max(50),
    bankName: z.string().default(""),
    holder: z.string().default(""),
    alias: z.string().default(""),
  }),
  shippingZones: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        provinces: z.array(z.string()).default([]),
        postalPrefixes: z.array(z.string()).default([]),
        cost: z.number(),
        freeOver: z.number().nullable().default(null),
        etaText: z.string().nullable().default(null),
        notes: z.string().nullable().default(null),
      }),
    )
    .default([]),
  pickupLocations: z
    .array(
      z.object({
        name: z.string(),
        address: z.string(),
        hoursText: z.string().nullable().default(null),
        instructions: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

type StoreConfig = z.output<typeof storeConfigSchema>;

/** Valida el bloque `store` y sus zonas/retiros con los mismos schemas del panel. */
function parseStoreConfig(raw: unknown, whatsappOverride: string | undefined) {
  const parsed = storeConfigSchema.safeParse(
    whatsappOverride && raw && typeof raw === "object" ? { ...raw, whatsapp: whatsappOverride } : raw,
  );
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  · store.${i.path.join(".")}: ${i.message}`);
    throw new Error(`El bloque «store» del JSON no es válido:\n${lines.join("\n")}`);
  }
  const config = parsed.data;
  const zones = config.shippingZones.map((z, i) => {
    const r = shippingZoneSchema.safeParse({
      name: z.name,
      type: z.type,
      cost: z.cost,
      free_over: z.freeOver,
      eta_text: z.etaText,
      notes: z.notes,
      is_active: true,
      geometry: null,
      provinces: z.provinces,
      postal_prefixes: z.postalPrefixes,
    });
    if (!r.success) throw new Error(`store.shippingZones.${i} (${z.name}): ${r.error.issues.map((x) => x.message).join("; ")}`);
    return r.data;
  });
  const pickups = config.pickupLocations.map((p, i) => {
    const r = pickupLocationSchema.safeParse({
      name: p.name,
      address: p.address,
      hours_text: p.hoursText,
      instructions_md: p.instructions,
      is_active: true,
      lat: null,
      lng: null,
    });
    if (!r.success) throw new Error(`store.pickupLocations.${i} (${p.name}): ${r.error.issues.map((x) => x.message).join("; ")}`);
    return r.data;
  });
  return { config, zones, pickups };
}

type ParsedStore = ReturnType<typeof parseStoreConfig>;

function printStorePlan({ config, zones, pickups }: ParsedStore, slug: string, whatsappFromEnv: boolean) {
  log(`Tienda «${slug}»: ${config.name} · rubro ${config.kind} · preset ${config.preset}`);
  console.info(`    WhatsApp: ${config.whatsapp}${whatsappFromEnv ? " (SEED_WHATSAPP)" : " (placeholder del JSON: definí SEED_WHATSAPP para recibir los pedidos)"}`);
  console.info(
    `    Transferencia: ${config.transfer.discountPercent} % de descuento · alias ${config.transfer.alias || "(sin alias)"} · titular ${config.transfer.holder || "(sin titular)"}`,
  );
  console.info(`    «Quedan pocas» desde ${config.lowStockThreshold} unidades por variante`);
  for (const z of zones) {
    console.info(
      `    Envío: ${z.name} · ${money(z.cost)}${z.free_over ? ` · gratis desde ${money(z.free_over)}` : ""}${z.eta_text ? ` · ${z.eta_text}` : ""}`,
    );
  }
  for (const p of pickups) console.info(`    Retiro: ${p.name} · ${p.address}${p.hours_text ? ` · ${p.hours_text}` : ""}`);
  console.info("    Plan: Pro activo si SEED_EMAIL es admin de plataforma (si no, los 14 días de Pro del alta)");
}

// ---------------------------------------------------------------------------
// Tienda y configuración
// ---------------------------------------------------------------------------

async function ensureStore(supabase: Db, slug: string, config: StoreConfig): Promise<{ store: SeedStore; created: boolean }> {
  const existing = await findStore(supabase, slug);
  if (existing) return { store: existing, created: false };

  const created = await supabase.rpc("create_store", {
    p_name: config.name,
    p_slug: slug,
    p_kind: config.kind,
    p_whatsapp: config.whatsapp,
    p_options: {
      currency: "ARS",
      city: "CABA",
      province: "Ciudad de Buenos Aires",
      transfer_enabled: true,
      whatsapp_enabled: true,
      transfer: {
        discount_percent: config.transfer.discountPercent,
        bank_name: config.transfer.bankName,
        holder: config.transfer.holder,
        alias: config.transfer.alias,
      },
    },
  });
  if (created.error) {
    throw new Error(
      `No se pudo crear «${slug}»: ${created.error.message}. Si el slug ya es de otra cuenta, usá SEED_STORE con otro; si llegaste a 3 tiendas, entrá con un admin de plataforma.`,
    );
  }
  const store = await findStore(supabase, slug);
  if (!store) throw new Error(`Se creó «${slug}» pero no se pudo leer`);
  return { store, created: true };
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function applySettings(supabase: Db, store: SeedStore, parsed: ParsedStore, whatsappFromEnv: boolean) {
  const { config, zones, pickups } = parsed;
  const storeId = store.id;

  // ---------------- store_settings ----------------
  const read = await supabase
    .from("store_settings")
    .select("tagline, whatsapp_phone, checkout")
    .eq("store_id", storeId)
    .maybeSingle();
  if (read.error) throw new Error(`leer configuración: ${read.error.message}`);
  const current = read.data;
  if (!current) throw new Error(`«${store.slug}» no tiene configuración (store_settings): creala desde /app/nueva`);
  const checkout = obj(current.checkout);
  const transfer = obj(checkout.transfer);
  const keep = (key: string, value: string) => (typeof transfer[key] === "string" && transfer[key] ? transfer[key] : value);
  const nextCheckout = {
    ...checkout,
    transfer: {
      ...transfer,
      enabled: true,
      discount_percent: config.transfer.discountPercent,
      bank_name: keep("bank_name", config.transfer.bankName),
      holder: keep("holder", config.transfer.holder),
      alias: keep("alias", config.transfer.alias),
    },
    whatsapp: { ...obj(checkout.whatsapp), enabled: true },
  };
  const settings = await supabase
    .from("store_settings")
    .update({
      tagline: current.tagline || config.tagline || null,
      // El WhatsApp del JSON es un placeholder: sólo pisa uno cargado si viene de SEED_WHATSAPP.
      whatsapp_phone: whatsappFromEnv || !current.whatsapp_phone ? config.whatsapp : current.whatsapp_phone,
      theme: PRESETS[config.preset as keyof typeof PRESETS] as unknown as Json,
      checkout: nextCheckout as Json,
      low_stock_threshold: config.lowStockThreshold,
    })
    .eq("store_id", storeId);
  if (settings.error) throw new Error(`configuración: ${settings.error.message}`);
  log(`Configuración: preset ${config.preset}, WhatsApp, «quedan pocas» desde ${config.lowStockThreshold}`);

  // ---------------- Medios de pago ----------------
  const methods = must(
    await supabase.from("payment_methods").select("id, code, type").eq("store_id", storeId),
    "leer medios de pago",
  );
  const transferMethod = methods.find((m) => m.type === "transfer");
  if (transferMethod) {
    const r = await supabase
      .from("payment_methods")
      .update({ is_active: true, discount_percent: config.transfer.discountPercent })
      .eq("store_id", storeId)
      .eq("id", transferMethod.id);
    if (r.error) throw new Error(`transferencia: ${r.error.message}`);
  } else {
    const r = await supabase.from("payment_methods").insert({
      store_id: storeId,
      code: "transfer",
      name: "Transferencia bancaria",
      type: "transfer",
      discount_percent: config.transfer.discountPercent,
      instructions_md: "Transferí el total a la cuenta indicada y envianos el comprobante por WhatsApp.",
      is_active: true,
      position: 0,
    });
    if (r.error) throw new Error(`transferencia: ${r.error.message}`);
  }
  const whatsappMethod = methods.find((m) => m.type === "whatsapp");
  if (whatsappMethod) {
    const r = await supabase.from("payment_methods").update({ is_active: true }).eq("store_id", storeId).eq("id", whatsappMethod.id);
    if (r.error) throw new Error(`acordar por WhatsApp: ${r.error.message}`);
  }
  log(`Medios de pago: transferencia con ${config.transfer.discountPercent} % de descuento y «Acordar con el vendedor»`);

  // ---------------- Envíos y retiro (por nombre) ----------------
  for (const [position, zone] of zones.entries()) {
    const found = must(
      await supabase.from("shipping_zones").select("id").eq("store_id", storeId).eq("name", zone.name).limit(1),
      "leer zonas de envío",
    );
    const row = { ...zone, geometry: zone.geometry as Json, position };
    const r = found[0]
      ? await supabase.from("shipping_zones").update(row).eq("store_id", storeId).eq("id", found[0].id)
      : await supabase.from("shipping_zones").insert({ ...row, store_id: storeId });
    if (r.error) throw new Error(`zona ${zone.name}: ${r.error.message}`);
  }
  for (const [position, pickup] of pickups.entries()) {
    const found = must(
      await supabase.from("pickup_locations").select("id").eq("store_id", storeId).eq("name", pickup.name).limit(1),
      "leer puntos de retiro",
    );
    const row = { ...pickup, position };
    const r = found[0]
      ? await supabase.from("pickup_locations").update(row).eq("store_id", storeId).eq("id", found[0].id)
      : await supabase.from("pickup_locations").insert({ ...row, store_id: storeId });
    if (r.error) throw new Error(`retiro ${pickup.name}: ${r.error.message}`);
  }
  log(`Envíos: ${zones.map((z) => z.name).join(", ") || "ninguno"} · Retiro: ${pickups.map((p) => p.name).join(", ") || "ninguno"}`);
}

/**
 * La demo no tiene que vencer: create_store() da 14 días de Pro y después
 * pasa a Free (25 productos, sin Responder). Con un admin de plataforma se
 * deja en Pro activo (manual, sin cobro); si no, se avisa.
 */
async function keepPro(supabase: Db, store: SeedStore) {
  const admin = await supabase.rpc("is_platform_admin");
  if (admin.error || !admin.data) {
    console.warn(
      `[seed] ${store.slug}: queda con el plan del alta (14 días de Pro). Para que la demo no pase a Free, un admin de plataforma la pone en Pro activo desde /platform.`,
    );
    return;
  }
  const r = await supabase.rpc("platform_set_plan", { p_store_id: store.id, p_plan_code: "pro", p_status: "active" });
  if (r.error) console.warn(`[seed] No se pudo dejar «${store.slug}» en Pro: ${r.error.message}`);
  else log("Plan: Pro activo (manual, sin cobro), para que la demo no venza");
}

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
    printStorePlan(parsed, slug, Boolean(whatsappEnv));
    printPlan(source, { file, storeSlug: slug, placeholders: !flags.skipImages });
    return;
  }

  const supabase = await connect();
  const { store, created } = await ensureStore(supabase, slug, parsed.config);
  log(created ? `Tienda creada: ${store.name} (${slug})` : `Tienda existente: ${store.name} (${slug})`);
  await applySettings(supabase, store, parsed, Boolean(whatsappEnv));
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
