/**
 * Alta y configuración de una tienda para los seeds (bloque `store`): crea
 * la tienda con create_store() o usa la existente, aplica preset, WhatsApp,
 * transferencia con descuento, «quedan pocas», zonas de envío y retiro, y la
 * deja en Pro activo si la cuenta es admin de plataforma.
 *
 * Lo usan `scripts/seed-demo-ropa.mts` (demo de ropa, bloque `store` de
 * data/demo-ropa.json) y `scripts/prospect-store.mts` (tienda de una
 * prospecta, armado desde data/prospectos/<slug>.json).
 */
import { z } from "zod";

import { isValidE164, normalizePhone } from "../../src/lib/schemas/settings";
import { pickupLocationSchema, shippingZoneSchema } from "../../src/lib/schemas/shipping";
import type { Json } from "../../src/lib/supabase/database.types";
import { PRESETS } from "../../src/lib/theme/presets";

import { findStore, log, money, must, type Db, type SeedStore } from "../seed-from-json.mjs";

// ---------------------------------------------------------------------------
// Bloque `store`
// ---------------------------------------------------------------------------

export const storeConfigSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(140).default(""),
  /** Rubro del alta (create_store): "moda" → preset atelier. */
  kind: z.string().default("moda"),
  preset: z.string().refine((id) => Object.hasOwn(PRESETS, id), "Preset desconocido (ver src/lib/theme/presets.ts)."),
  whatsapp: z.string().transform(normalizePhone).refine(isValidE164, "WhatsApp con código de país y área, sin 0 ni 15."),
  lowStockThreshold: z.number().int().min(0).max(100).default(3),
  /** Ciudad y provincia del alta (dirección de la tienda en create_store). */
  city: z.string().trim().max(120).default("CABA"),
  province: z.string().trim().max(120).default("Ciudad de Buenos Aires"),
  /** URL de Instagram (https://…): sólo se carga si la tienda no tiene una. */
  instagram: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Tiene que empezar con https://.")
    .default(""),
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

export type StoreConfigInput = z.input<typeof storeConfigSchema>;
export type StoreConfig = z.output<typeof storeConfigSchema>;

/** Valida el bloque `store` y sus zonas/retiros con los mismos schemas del panel. */
export function parseStoreConfig(raw: unknown, whatsappOverride?: string) {
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

export type ParsedStore = ReturnType<typeof parseStoreConfig>;

/** Lo que haría con la tienda (--dry-run). `whatsappNote`: de dónde sale el número. */
export function printStorePlan({ config, zones, pickups }: ParsedStore, slug: string, whatsappNote: string) {
  log(`Tienda «${slug}»: ${config.name} · rubro ${config.kind} · preset ${config.preset}`);
  console.info(`    WhatsApp: ${config.whatsapp}${whatsappNote ? ` (${whatsappNote})` : ""}`);
  console.info(
    `    Transferencia: ${config.transfer.discountPercent} % de descuento · alias ${config.transfer.alias || "(sin alias)"} · titular ${config.transfer.holder || "(sin titular)"}`,
  );
  console.info(`    «Quedan pocas» desde ${config.lowStockThreshold} unidades por variante`);
  if (config.instagram) console.info(`    Instagram: ${config.instagram} (si la tienda no tiene uno cargado)`);
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

const DEFAULT_SLUG_HINT = "Si el slug ya es de otra cuenta, usá SEED_STORE con otro; si llegaste a 3 tiendas, entrá con un admin de plataforma.";

/** La tienda `slug`: la existente (dueño o admin) o una nueva con create_store(). */
export async function ensureStore(
  supabase: Db,
  slug: string,
  config: StoreConfig,
  slugHint = DEFAULT_SLUG_HINT,
): Promise<{ store: SeedStore; created: boolean }> {
  const existing = await findStore(supabase, slug);
  if (existing) return { store: existing, created: false };

  const created = await supabase.rpc("create_store", {
    p_name: config.name,
    p_slug: slug,
    p_kind: config.kind,
    p_whatsapp: config.whatsapp,
    p_options: {
      currency: "ARS",
      city: config.city,
      province: config.province,
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
  if (created.error) throw new Error(`No se pudo crear «${slug}»: ${created.error.message}. ${slugHint}`);
  const store = await findStore(supabase, slug);
  if (!store) throw new Error(`Se creó «${slug}» pero no se pudo leer`);
  return { store, created: true };
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export interface ApplySettingsOptions {
  /**
   * ¿El WhatsApp del bloque pisa uno ya cargado? En la demo el del JSON es un
   * placeholder (sólo pisa si viene de SEED_WHATSAPP); en la tienda de una
   * prospecta es el suyo.
   */
  overwriteWhatsapp: boolean;
}

/** Configuración idempotente: preset, WhatsApp, transferencia, envíos y retiro (por nombre). */
export async function applySettings(supabase: Db, store: SeedStore, parsed: ParsedStore, opts: ApplySettingsOptions) {
  const { config, zones, pickups } = parsed;
  const storeId = store.id;

  // ---------------- store_settings ----------------
  const read = await supabase
    .from("store_settings")
    .select("tagline, whatsapp_phone, checkout, social")
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
  const social = obj(current.social);
  const setInstagram = Boolean(config.instagram) && !(typeof social.instagram === "string" && social.instagram);
  const settings = await supabase
    .from("store_settings")
    .update({
      tagline: current.tagline || config.tagline || null,
      whatsapp_phone: opts.overwriteWhatsapp || !current.whatsapp_phone ? config.whatsapp : current.whatsapp_phone,
      theme: PRESETS[config.preset as keyof typeof PRESETS] as unknown as Json,
      checkout: nextCheckout as Json,
      low_stock_threshold: config.lowStockThreshold,
      ...(setInstagram ? { social: { ...social, instagram: config.instagram } as Json } : {}),
    })
    .eq("store_id", storeId);
  if (settings.error) throw new Error(`configuración: ${settings.error.message}`);
  log(
    `Configuración: preset ${config.preset}, WhatsApp, «quedan pocas» desde ${config.lowStockThreshold}${setInstagram ? ", Instagram" : ""}`,
  );

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
 * La tienda no tiene que vencer: create_store() da 14 días de Pro y después
 * pasa a Free (25 productos, sin Responder). Con un admin de plataforma se
 * deja en Pro activo (manual, sin cobro); si no, se avisa.
 */
export async function keepPro(supabase: Db, store: SeedStore) {
  const admin = await supabase.rpc("is_platform_admin");
  if (admin.error || !admin.data) {
    console.warn(
      `[seed] ${store.slug}: queda con el plan del alta (14 días de Pro). Para que no pase a Free, un admin de plataforma la pone en Pro activo desde /platform.`,
    );
    return;
  }
  const r = await supabase.rpc("platform_set_plan", { p_store_id: store.id, p_plan_code: "pro", p_status: "active" });
  if (r.error) console.warn(`[seed] No se pudo dejar «${store.slug}» en Pro: ${r.error.message}`);
  else log("Plan: Pro activo (manual, sin cobro), para que no venza");
}
