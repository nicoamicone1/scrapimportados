"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { ADMIN_STORE_COOKIE, ADMIN_STORE_COOKIE_OPTIONS, requirePlatformAdmin } from "@/lib/auth";
import { billingEnabled, cancelPreapproval, MercadoPagoError } from "@/lib/billing/mercadopago";
import { mercadoPagoDebitActive } from "@/lib/billing/state";
import { storeTag } from "@/lib/cache-tags";
import { PLANS_TAG } from "@/lib/plans/catalog";
import { FEATURE_KEYS, LIMIT_KEYS } from "@/lib/plans";

/*
 * Acciones del superadmin (/platform). Todas validan
 * `profiles.is_platform_admin` acá y además en SQL (platform_* son
 * security definer con chequeo propio; `plans` tiene RLS de superadmin).
 */

const idSchema = z.string().uuid();

async function auditStore(storeId: string, action: string, summary: string) {
  const { supabase, user } = await requirePlatformAdmin();
  const { error } = await supabase.from("audit_log").insert({
    store_id: storeId,
    actor_id: user.id,
    actor_email: user.email ?? null,
    action,
    entity: "store",
    entity_id: storeId,
    summary,
  });
  if (error) console.error("[audit]", error.message);
}

const planSchema = z
  .object({
    storeId: idSchema,
    plan: z.string().min(1),
    status: z.enum(["trialing", "active", "past_due", "cancelled"]),
    trialEndsAt: z.string().optional().default(""),
    /** El superadmin confirmó "Se cancelará el débito automático en MercadoPago". */
    cancelMercadoPago: z.boolean().optional().default(false),
  })
  .refine((v) => v.status !== "trialing" || Boolean(v.trialEndsAt), { path: ["trialEndsAt"], message: "Indicá hasta cuándo dura la prueba." });

/**
 * Cambio manual de plan. Cualquier cambio que no sea extender la prueba deja
 * la tienda en `provider = 'manual'` (los avisos de MP ya no la tocan): si
 * tenía un débito automático vigente en MercadoPago, primero se cancela allá
 * (con confirmación en el formulario), para que no siga cobrando.
 */
export async function setStorePlan(input: z.input<typeof planSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const trial = v.status === "trialing" ? new Date(`${v.trialEndsAt}T23:59:59-03:00`).toISOString() : undefined;

    let mpNote = "";
    if (v.status !== "trialing") {
      // Sin la migración 0015 no hay columnas de MP: no hay nada que cancelar.
      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("provider, provider_ref, provider_status")
        .eq("store_id", v.storeId)
        .maybeSingle();
      if (!subError && sub && mercadoPagoDebitActive(sub) && sub.provider_ref) {
        if (!v.cancelMercadoPago) return fail("La tienda paga con MercadoPago: confirmá que se cancela el débito automático.");
        if (!billingEnabled()) {
          return fail("Falta MP_ACCESS_TOKEN: no podemos cancelar el débito automático. Cancelalo en MercadoPago y después guardá el plan.");
        }
        try {
          await cancelPreapproval(sub.provider_ref);
          mpNote = ` · canceló el débito automático ${sub.provider_ref} en MercadoPago`;
        } catch (err) {
          if (!(err instanceof MercadoPagoError)) throw err;
          console.error("[billing]", err.message);
          // 404: MP ya no la tiene; se sigue. Cualquier otra falla: no se toca el plan.
          if (err.status !== 404) return fail("MercadoPago no canceló el débito automático. Probá de nuevo en unos minutos; el plan no cambió.");
          mpNote = ` · MercadoPago no encontró el débito automático ${sub.provider_ref}`;
        }
      }
    }

    const { error } = await supabase.rpc("platform_set_plan", {
      p_store_id: v.storeId,
      p_plan_code: v.plan,
      p_status: v.status,
      p_trial_ends_at: trial,
    });
    if (error) return fail(error.message);
    await auditStore(v.storeId, "platform.plan", `Superadmin: plan ${v.plan} (${v.status})${mpNote}`);
    revalidatePath("/platform");
    return ok();
  });
}

/** Extiende la prueba N días desde hoy (o desde el vencimiento si todavía no venció). */
export async function extendTrial(input: { storeId: string; days: number }): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const parsed = z.object({ storeId: idSchema, days: z.number().int().min(1).max(90) }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_code, status, trial_ends_at")
      .eq("store_id", parsed.data.storeId)
      .maybeSingle();
    const base = sub?.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date() ? new Date(sub.trial_ends_at) : new Date();
    const until = new Date(base.getTime() + parsed.data.days * 86_400_000).toISOString();
    const plan = sub?.status === "trialing" ? sub.plan_code : "pro";
    const { error } = await supabase.rpc("platform_set_plan", {
      p_store_id: parsed.data.storeId,
      p_plan_code: plan,
      p_status: "trialing",
      p_trial_ends_at: until,
    });
    if (error) return fail(error.message);
    await auditStore(parsed.data.storeId, "platform.trial", `Superadmin: prueba ${plan} extendida ${parsed.data.days} días`);
    revalidatePath("/platform");
    return ok();
  });
}

export async function setStoreStatus(input: { storeId: string; status: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const parsed = z.object({ storeId: idSchema, status: z.enum(["active", "suspended", "deleted"]) }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { data: store } = await supabase.from("stores").select("slug").eq("id", parsed.data.storeId).maybeSingle();
    const { error } = await supabase.rpc("platform_set_store_status", { p_store_id: parsed.data.storeId, p_status: parsed.data.status });
    if (error) return fail(error.message);
    if (store) revalidateTag(storeTag(store.slug), "max");
    await auditStore(parsed.data.storeId, "platform.status", `Superadmin: estado ${parsed.data.status}`);
    revalidatePath("/platform");
    return ok();
  });
}

/** "Entrar como": fija la cookie de tienda activa y abre el panel. */
export async function enterAsStore(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const parsed = idSchema.safeParse(String(formData.get("storeId") ?? ""));
  if (!parsed.success) redirect("/platform");
  (await cookies()).set(ADMIN_STORE_COOKIE, parsed.data, ADMIN_STORE_COOKIE_OPTIONS);
  redirect("/admin");
}

const planEditSchema = z.object({
  code: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).optional().default(""),
  price: z.union([z.literal(""), z.coerce.number().min(0)]),
  isPublic: z.boolean(),
  features: z.record(z.string(), z.boolean()),
  limits: z.record(z.string(), z.union([z.literal(""), z.coerce.number().int().min(0)])),
});

/** Edición de un plan (precio, visibilidad, features y límites; vacío = ilimitado / a medida). */
export async function updatePlan(input: z.input<typeof planEditSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const parsed = planEditSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const features = Object.fromEntries(FEATURE_KEYS.map((k) => [k, Boolean(v.features[k])]));
    const limits = Object.fromEntries(LIMIT_KEYS.map((k) => [k, v.limits[k] === "" || v.limits[k] === undefined ? null : Number(v.limits[k])]));
    const { error } = await supabase
      .from("plans")
      .update({
        name: v.name,
        description: v.description || null,
        price_monthly: v.price === "" ? null : v.price,
        is_public: v.isPublic,
        features,
        limits,
      })
      .eq("code", v.code);
    if (error) return fail(error.message);
    revalidateTag(PLANS_TAG, "max");
    revalidatePath("/platform/planes");
    return ok();
  });
}
