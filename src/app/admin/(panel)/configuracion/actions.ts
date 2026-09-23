"use server";

import { revalidateTag } from "next/cache";

import { parseCsv } from "@/lib/admin/csv";
import { flatDiff } from "@/lib/admin/diff";
import { requirePermission } from "@/lib/admin/require";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import type { AdminContext } from "@/lib/auth";
import { tagFor } from "@/lib/cache-tags";
import { assertFeature } from "@/lib/plans";
import {
  legalSettingsSchema,
  normalizeFromPath,
  paymentsSettingsSchema,
  redirectSchema,
  seoSettingsSchema,
  storeSettingsSchema,
} from "@/lib/schemas/settings";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";

/*
 * Acciones de Configuración (agente H). Patrón: requirePermission
 * ('settings.write') → zod → escribir → logAudit con diff → revalidateTag.
 * Todo sobre la tienda activa (`ctx.store.id`): `store_settings` es una fila
 * por tienda, los métodos de pago y las redirecciones son de la tienda.
 * Los jsonb se MERGEAN con lo que ya hay (no se pierden claves que agreguen
 * otros módulos). Plan: `analytics.integrations` para cargar o cambiar los
 * IDs de GA4 / GTM / Meta Pixel.
 */

type Ctx = Pick<AdminContext, "supabase" | "store">;

type Obj = { [key: string]: Json | undefined };

function obj(value: Json | undefined): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function readSettings(ctx: Ctx) {
  const { data, error } = await ctx.supabase.from("store_settings").select("*").eq("store_id", ctx.store.id).single();
  if (error || !data) throw new Error(`No se pudo leer store_settings: ${error?.message ?? "sin fila"}`);
  return data;
}

async function writeSettings(ctx: Ctx, patch: TablesUpdate<"store_settings">) {
  const { error } = await ctx.supabase.from("store_settings").update(patch).eq("store_id", ctx.store.id);
  if (error) throw new Error(error.message);
}

function revalidate(ctx: Ctx, ...bases: ("settings" | "payment-methods" | "products" | "redirects")[]) {
  for (const base of bases) revalidateTag(tagFor(base, ctx.store.id), "max");
}

function hasChanges(diff: Json): boolean {
  return Boolean(diff && typeof diff === "object" && Object.keys(diff).length);
}

// ---------------------------------------------------------------------
// 1. Tienda
// ---------------------------------------------------------------------

export async function saveStoreSettings(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    const parsed = storeSettingsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const row = await readSettings(ctx);
    const social: Obj = { ...obj(row.social), ...v.social };
    const patch = {
      name: v.name,
      tagline: v.tagline,
      contact_email: v.contact_email,
      contact_phone: v.contact_phone,
      whatsapp_phone: v.whatsapp_phone,
      address: v.address,
      currency: v.currency,
      locale: v.locale,
      timezone: v.timezone,
      social,
    };
    const before: Obj = {
      name: row.name,
      tagline: row.tagline,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      whatsapp_phone: row.whatsapp_phone,
      address: row.address,
      currency: row.currency,
      locale: row.locale,
      timezone: row.timezone,
      social: row.social,
    };
    const diff = flatDiff(before, patch);
    if (!hasChanges(diff)) return ok();

    await writeSettings(ctx, patch);
    await logAudit(ctx, { action: "settings.store", entity: "settings", entityId: "tienda", summary: "Actualizó los datos de la tienda", diff });
    revalidate(ctx, "settings");
    return ok();
  });
}

// ---------------------------------------------------------------------
// 2. Pagos y checkout
// ---------------------------------------------------------------------

export async function savePaymentsSettings(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    const parsed = paymentsSettingsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    if (!v.methods.some((m) => m.is_active)) {
      return fail("Tiene que quedar al menos un método de pago activo.", { methods: ["Activá al menos un método de pago."] });
    }
    const transfer = v.methods.find((m) => m.type === "transfer");
    if (transfer?.is_active && (!v.transfer.cbu && !v.transfer.alias)) {
      return fail("Para cobrar por transferencia cargá el CBU/CVU o el alias.", {
        "transfer.cbu": ["Cargá el CBU/CVU o el alias."],
        "transfer.alias": ["Cargá el CBU/CVU o el alias."],
      });
    }

    const { supabase } = ctx;
    const { data: currentMethods, error: pmError } = await supabase
      .from("payment_methods")
      .select("id, name, is_active, discount_percent, instructions_md, position")
      .eq("store_id", ctx.store.id);
    if (pmError) throw new Error(pmError.message);
    const byId = new Map((currentMethods ?? []).map((m) => [m.id, m]));

    const methodDiff: Obj = {};
    for (const [index, m] of v.methods.entries()) {
      const cur = byId.get(m.id);
      if (!cur) return fail("Un método de pago ya no existe. Recargá la página.");
      const next = {
        name: m.name,
        is_active: m.is_active,
        discount_percent: m.discount_percent,
        instructions_md: m.instructions_md || null,
        position: index,
      };
      const d = flatDiff(
        { name: cur.name, is_active: cur.is_active, discount_percent: Number(cur.discount_percent), instructions_md: cur.instructions_md, position: cur.position },
        next,
      );
      if (Object.keys(d).length) {
        const { error } = await supabase.from("payment_methods").update(next).eq("store_id", ctx.store.id).eq("id", m.id);
        if (error) throw new Error(error.message);
        for (const [k, val] of Object.entries(d)) methodDiff[`${m.code}.${k}`] = val;
      }
    }

    const row = await readSettings(ctx);
    const checkout = obj(row.checkout);
    // Prender el aviso de carritos abandonados es de Starter en adelante (apagarlo, siempre).
    if (v.abandoned_reminders && checkout.abandoned_reminders !== true) assertFeature(ctx, "marketing.abandoned");
    const whatsappMethod = v.methods.find((m) => m.type === "whatsapp");
    const nextCheckout: Obj = {
      ...checkout,
      transfer: {
        ...obj(checkout.transfer),
        ...v.transfer,
        // Espejo legado: la fuente de verdad del % y del estado es payment_methods.
        enabled: transfer ? transfer.is_active : false,
        discount_percent: transfer ? transfer.discount_percent : 0,
      },
      whatsapp: {
        ...obj(checkout.whatsapp),
        enabled: whatsappMethod ? whatsappMethod.is_active : false,
        message_template: v.whatsapp_template,
      },
      require_phone: v.require_phone,
      order_notes_enabled: v.order_notes_enabled,
      abandoned_reminders: v.abandoned_reminders,
      min_order_total: v.min_order_total,
      reservation_hours: v.reservation_hours,
    };
    const patch = {
      checkout: nextCheckout,
      inventory_policy: v.inventory_policy,
      low_stock_threshold: v.low_stock_threshold,
      catalog: { ...obj(row.catalog), out_of_stock_display: v.out_of_stock_display },
      free_shipping_bar: { ...obj(row.free_shipping_bar), ...v.free_shipping_bar },
      whatsapp_button: { ...obj(row.whatsapp_button), ...v.whatsapp_button },
    };
    const settingsDiff = flatDiff(
      {
        checkout: row.checkout,
        inventory_policy: row.inventory_policy,
        low_stock_threshold: row.low_stock_threshold,
        catalog: row.catalog,
        free_shipping_bar: row.free_shipping_bar,
        whatsapp_button: row.whatsapp_button,
      },
      patch,
    );

    if (hasChanges(settingsDiff)) await writeSettings(ctx, patch);
    const diff = { ...methodDiff, ...settingsDiff };
    if (!hasChanges(diff)) return ok();

    await logAudit(ctx, {
      action: "settings.payments",
      entity: "settings",
      entityId: "pagos",
      summary: "Actualizó pagos y checkout",
      diff,
    });
    revalidate(ctx, "settings");
    if (Object.keys(methodDiff).length) revalidate(ctx, "payment-methods");
    if (Object.keys(settingsDiff).some((k) => k.startsWith("catalog") || k.startsWith("low_stock"))) revalidate(ctx, "products");
    return ok();
  });
}

// ---------------------------------------------------------------------
// 3. Impuestos y legales
// ---------------------------------------------------------------------

export async function saveLegalSettings(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    const parsed = legalSettingsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const row = await readSettings(ctx);
    const legal = obj(row.legal);
    const patch = {
      tax: { ...obj(row.tax), ...v.tax },
      legal: { ...legal, ...v.legal, data_fiscal: { ...obj(legal.data_fiscal), ...v.legal.data_fiscal } },
      policies: { ...obj(row.policies), ...v.policies },
    };
    const diff = flatDiff({ tax: row.tax, legal: row.legal, policies: row.policies }, patch);
    if (!hasChanges(diff)) return ok();

    await writeSettings(ctx, patch);
    // Las políticas son largas: en el diff sólo se registra que cambiaron.
    const compact: Obj = {};
    for (const [k, val] of Object.entries(diff)) {
      compact[k] = k.startsWith("policies.") ? ["(texto anterior)", "(texto nuevo)"] : val;
    }
    await logAudit(ctx, { action: "settings.legal", entity: "settings", entityId: "legales", summary: "Actualizó impuestos, datos legales y políticas", diff: compact });
    revalidate(ctx, "settings");
    return ok();
  });
}

// ---------------------------------------------------------------------
// 4. SEO, integraciones y mantenimiento
// ---------------------------------------------------------------------

export async function saveSeoSettings(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    const parsed = seoSettingsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const row = await readSettings(ctx);
    // Medición (GA4 / GTM / Pixel): cargar o cambiar un ID exige el plan. Los
    // que ya estaban guardados se pueden dejar como están o borrar.
    const currentIntegrations = obj(row.integrations);
    const trackingChanged = (["ga4_id", "gtm_id", "meta_pixel_id"] as const).some(
      (k) => v.integrations[k] && v.integrations[k] !== currentIntegrations[k],
    );
    if (trackingChanged) assertFeature(ctx, "analytics.integrations");
    const patch = {
      seo: { ...obj(row.seo), ...v.seo },
      integrations: { ...obj(row.integrations), ...v.integrations },
      maintenance: { ...obj(row.maintenance), ...v.maintenance },
    };
    const diff = flatDiff({ seo: row.seo, integrations: row.integrations, maintenance: row.maintenance }, patch);
    if (!hasChanges(diff)) return ok();

    await writeSettings(ctx, patch);
    const maintenanceChanged = Object.keys(diff).includes("maintenance.enabled");
    await logAudit(ctx, {
      action: maintenanceChanged ? (v.maintenance.enabled ? "settings.maintenance_on" : "settings.maintenance_off") : "settings.seo",
      entity: "settings",
      entityId: "seo",
      summary: maintenanceChanged
        ? v.maintenance.enabled
          ? "Activó el modo mantenimiento"
          : "Desactivó el modo mantenimiento"
        : "Actualizó SEO e integraciones",
      diff,
    });
    revalidate(ctx, "settings");
    return ok();
  });
}

// ---------------------------------------------------------------------
// Redirecciones 301
// ---------------------------------------------------------------------

export async function createRedirect(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    const parsed = redirectSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { from_path, to_path } = parsed.data;

    const { data: existing } = await ctx.supabase
      .from("redirects")
      .select("id")
      .eq("store_id", ctx.store.id)
      .eq("from_path", from_path)
      .maybeSingle();
    if (existing) return fail("Ya hay una redirección desde esa ruta.", { from_path: ["Ya hay una redirección desde esa ruta."] });

    const { data, error } = await ctx.supabase
      .from("redirects")
      .insert({ store_id: ctx.store.id, from_path, to_path, created_by: ctx.user.id })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return fail("Ya hay una redirección desde esa ruta.", { from_path: ["Ya hay una redirección desde esa ruta."] });
      throw new Error(error.message);
    }
    await logAudit(ctx, {
      action: "redirect.create",
      entity: "redirect",
      entityId: data.id,
      summary: `Creó la redirección ${from_path} → ${to_path}`,
      diff: { from_path: [null, from_path], to_path: [null, to_path] },
    });
    revalidate(ctx, "redirects");
    return ok({ id: data.id });
  });
}

export async function deleteRedirects(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
    if (!clean.length) return fail("Elegí al menos una redirección.");
    const { data, error } = await ctx.supabase
      .from("redirects")
      .delete()
      .eq("store_id", ctx.store.id)
      .in("id", clean)
      .select("id, from_path, to_path");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    await logAudit(ctx, {
      action: "redirect.delete",
      entity: "redirect",
      entityId: rows.length === 1 ? rows[0].id : null,
      summary:
        rows.length === 1 ? `Borró la redirección ${rows[0].from_path} → ${rows[0].to_path}` : `Borró ${rows.length} redirecciones`,
      diff: Object.fromEntries(rows.map((r) => [r.from_path, [r.to_path, null]])),
    });
    revalidate(ctx, "redirects");
    return ok({ deleted: rows.length });
  });
}

export interface RedirectImportRow {
  line: number;
  from: string;
  to: string;
  error: string | null;
}

/** Valida un CSV `from,to` (con o sin encabezado) contra el schema y la base. */
async function analyzeRedirectsCsv(ctx: Ctx, text: string): Promise<RedirectImportRow[]> {
  const table = parseCsv(text);
  if (!table.length) return [];
  const first = table[0].map((c) => c.trim().toLowerCase());
  const hasHeader = ["from", "desde", "from_path", "origen"].includes(first[0] ?? "");
  const body = hasHeader ? table.slice(1) : table;

  const candidates = body.slice(0, 5000).map((cells, i) => ({
    line: i + (hasHeader ? 2 : 1),
    from: normalizeFromPath(cells[0] ?? ""),
    to: (cells[1] ?? "").trim(),
  }));

  const froms = [...new Set(candidates.map((c) => c.from).filter((f) => f.startsWith("/")))];
  const existing = new Set<string>();
  for (let i = 0; i < froms.length; i += 200) {
    const { data } = await ctx.supabase
      .from("redirects")
      .select("from_path")
      .eq("store_id", ctx.store.id)
      .in("from_path", froms.slice(i, i + 200));
    for (const r of data ?? []) existing.add(r.from_path);
  }

  const seen = new Set<string>();
  return candidates.map((c) => {
    const parsed = redirectSchema.safeParse({ from_path: c.from, to_path: c.to });
    let error: string | null = parsed.success ? null : parsed.error.issues[0]?.message ?? "Fila inválida.";
    if (!error && existing.has(c.from)) error = "Ya existe una redirección desde esa ruta.";
    if (!error && seen.has(c.from)) error = "Ruta repetida en el archivo.";
    seen.add(c.from);
    return { ...c, error };
  });
}

export async function previewRedirectsCsv(text: string): Promise<ActionResult<{ rows: RedirectImportRow[]; truncated: boolean }>> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    if (typeof text !== "string" || !text.trim()) return fail("El archivo está vacío.");
    if (text.length > 2_000_000) return fail("El archivo es muy grande (máximo 2 MB).");
    const rows = await analyzeRedirectsCsv(ctx, text);
    if (!rows.length) return fail("No encontramos filas con el formato from,to.");
    return ok({ rows: rows.slice(0, 500), truncated: rows.length > 500 });
  });
}

export async function importRedirectsCsv(text: string): Promise<ActionResult<{ created: number; skipped: number }>> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    if (typeof text !== "string" || !text.trim()) return fail("El archivo está vacío.");
    if (text.length > 2_000_000) return fail("El archivo es muy grande (máximo 2 MB).");
    const rows = await analyzeRedirectsCsv(ctx, text);
    const valid = rows.filter((r) => !r.error);
    if (!valid.length) return fail("No hay filas válidas para importar.");

    let created = 0;
    for (let i = 0; i < valid.length; i += 500) {
      const batch = valid
        .slice(i, i + 500)
        .map((r) => ({ store_id: ctx.store.id, from_path: r.from, to_path: r.to, created_by: ctx.user.id }));
      const { data, error } = await ctx.supabase
        .from("redirects")
        .upsert(batch, { onConflict: "store_id,from_path", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      created += data?.length ?? 0;
    }
    await logAudit(ctx, {
      action: "redirect.import",
      entity: "redirect",
      summary: `Importó ${created} redirecciones desde CSV`,
      diff: { creadas: [null, created], omitidas: [null, rows.length - created] },
    });
    revalidate(ctx, "redirects");
    return ok({ created, skipped: rows.length - created });
  });
}
