"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { billingEnabled, MercadoPagoError } from "@/lib/billing/mercadopago";
import { billingServiceClient } from "@/lib/billing/service";
import { describeResult, supabaseBillingRepo, syncPreapproval } from "@/lib/billing/sync";
import { formatDate } from "@/lib/dates";
import { isModuleLive, MODULE_CODES, MODULE_STATUS_LABELS, MODULE_STATUSES, MODULES, modulesTag } from "@/lib/modules/registry";

/**
 * "Sincronizar con MercadoPago" (superadmin): relee el preapproval de la
 * tienda en MP y aplica el estado con `billing_apply_subscription`, igual que
 * el webhook (sirve si un aviso se perdió o para verificar el estado).
 */
export async function syncStoreBilling(input: { storeId: string }): Promise<ActionResult<{ summary: string }>> {
  return runAction(async () => {
    const { supabase, user } = await requirePlatformAdmin();
    const parsed = z.object({ storeId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { storeId } = parsed.data;
    if (!billingEnabled()) return fail("Falta MP_ACCESS_TOKEN: el cobro con MercadoPago está apagado.");
    const db = billingServiceClient();
    if (!db) return fail("Falta SUPABASE_SERVICE_ROLE_KEY: no se puede aplicar el estado de MercadoPago.");

    const { data: sub, error } = await supabase.from("subscriptions").select("provider, provider_ref").eq("store_id", storeId).maybeSingle();
    if (error) return fail(error.message);
    if (!sub?.provider_ref) return fail("La tienda no tiene una suscripción de MercadoPago.");

    let summary: string;
    try {
      const result = await syncPreapproval(sub.provider_ref, { expectedStoreId: storeId }, { repo: supabaseBillingRepo(db) });
      summary = describeResult(result);
    } catch (err) {
      if (err instanceof MercadoPagoError) {
        console.error("[billing]", err.message);
        return fail(err.status === 404 ? "MercadoPago no encuentra esa suscripción." : "MercadoPago no respondió. Probá de nuevo en unos minutos.");
      }
      throw err;
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      store_id: storeId,
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "platform.billing_sync",
      entity: "subscription",
      entity_id: storeId,
      summary: `Superadmin: sincronizó MercadoPago. ${summary}`,
    });
    if (auditError) console.error("[audit]", auditError.message);
    revalidatePath(`/platform/tiendas/${storeId}`);
    return ok({ summary });
  });
}

const moduleSchema = z.object({
  storeId: z.string().uuid(),
  code: z.enum(MODULE_CODES),
  status: z.enum(MODULE_STATUSES),
  /** "YYYY-MM-DD" (vence a las 23:59 de Buenos Aires) o "" = sin vencimiento. */
  expiresAt: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Fecha inválida.")
    .optional()
    .default(""),
  notes: z.string().trim().max(500, "Máximo 500 caracteres.").optional().default(""),
});

/**
 * Activa, pone en prueba o desactiva una app en una tienda (docs/modules §1.3).
 * Upsert en `store_modules` (RLS: sólo superadmin escribe). `activated_at` se
 * renueva sólo cuando la app pasa de apagada/vencida a vigente.
 */
export async function setStoreModule(input: z.input<typeof moduleSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase, user } = await requirePlatformAdmin();
    const parsed = moduleSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const expiresAt = v.expiresAt ? new Date(`${v.expiresAt}T23:59:59-03:00`).toISOString() : null;
    if (expiresAt && v.status !== "disabled" && new Date(expiresAt) <= new Date()) {
      return fail("El vencimiento tiene que ser a futuro (o dejalo vacío).", { expiresAt: ["Tiene que ser a futuro."] });
    }

    const { data: before, error: readError } = await supabase
      .from("store_modules")
      .select("status, expires_at, notes")
      .eq("store_id", v.storeId)
      .eq("module_code", v.code)
      .maybeSingle();
    if (readError) return fail("No se pudo leer el estado de la app. ¿Está aplicada la migración 0022?");

    const now = new Date();
    const wasLive = before ? isModuleLive(before, now) : false;
    const willBeLive = isModuleLive({ status: v.status, expires_at: expiresAt }, now);
    const notes = v.notes || null;
    const { error } = await supabase.from("store_modules").upsert(
      {
        store_id: v.storeId,
        module_code: v.code,
        status: v.status,
        expires_at: expiresAt,
        notes,
        activated_by: user.id,
        ...(willBeLive && !wasLive ? { activated_at: now.toISOString() } : {}),
      },
      { onConflict: "store_id,module_code" },
    );
    if (error) return fail(`No se pudo guardar: ${error.message}`);

    const name = MODULES[v.code].name;
    const label = `${MODULE_STATUS_LABELS[v.status]}${expiresAt && v.status !== "disabled" ? ` hasta el ${formatDate(expiresAt)}` : ""}`;
    const { error: auditError } = await supabase.from("audit_log").insert({
      store_id: v.storeId,
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "platform.module_set",
      entity: "store_module",
      entity_id: v.storeId,
      summary: `Superadmin: app ${name} → ${label}.`,
      diff: {
        module: v.code,
        status: [before?.status ?? null, v.status],
        expires_at: [before?.expires_at ?? null, expiresAt],
        notes: [before?.notes ?? null, notes],
      },
    });
    if (auditError) console.error("[audit]", auditError.message);

    // Storefront: rutas/bloques de la app (storeHasModule) y la config pública del cotizador.
    revalidateTag(modulesTag(v.storeId), "max");
    if (v.code === "print3d") revalidateTag(`print3d:${v.storeId}`, "max");
    revalidatePath(`/platform/tiendas/${v.storeId}`);
    return ok();
  });
}
