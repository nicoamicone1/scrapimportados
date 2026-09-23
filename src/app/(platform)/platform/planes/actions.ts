"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { billingEnabled, getPreapprovalPlan, MercadoPagoError } from "@/lib/billing/mercadopago";
import type { MpPreapprovalPlan } from "@/lib/billing/types";
import { PLANS_TAG } from "@/lib/plans/catalog";

const mpPlanIdSchema = z
  .string()
  .trim()
  .max(80)
  .regex(/^[A-Za-z0-9_-]*$/, "Pegá sólo el id del plan de MercadoPago (letras y números).");

/** "Pro · ARS 34999 cada 1 months · active" (lo que devuelve MP del plan). */
function describeMpPlan(mp: MpPreapprovalPlan): string {
  const ar = mp.auto_recurring;
  return [mp.reason, ar?.transaction_amount ? `${ar.currency_id ?? ""} ${ar.transaction_amount} cada ${ar.frequency ?? 1} ${ar.frequency_type ?? "months"}` : null, mp.status]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Lee el plan en MercadoPago y devuelve el error para el superadmin, o el
 * detalle. `check` agrega un control propio (por ejemplo, la frecuencia).
 */
async function verifyMpPlan(id: string, check?: (mp: MpPreapprovalPlan) => string | null): Promise<{ error: string } | { detail: string }> {
  try {
    const mp = await getPreapprovalPlan(id);
    if (mp.status && mp.status !== "active") return { error: `Ese plan de MercadoPago está ${mp.status}: activalo en MercadoPago antes de usarlo.` };
    const problem = check?.(mp);
    if (problem) return { error: problem };
    return { detail: describeMpPlan(mp) };
  } catch (err) {
    if (err instanceof MercadoPagoError && err.status === 404) return { error: "MercadoPago no encuentra ese plan. Revisá el id." };
    if (err instanceof MercadoPagoError) {
      console.error("[billing]", err.message);
      return { error: "No pudimos verificar el plan en MercadoPago. Probá de nuevo en unos minutos." };
    }
    throw err;
  }
}

const schema = z.object({
  code: z.string().min(1),
  mpPlanId: mpPlanIdSchema,
});

/**
 * `plans.mp_plan_id`: el `preapproval_plan` de MercadoPago que cobra este plan
 * (vacío = no se paga con MP, sólo por WhatsApp). Con MP_ACCESS_TOKEN se
 * verifica que el plan exista en MercadoPago antes de guardarlo.
 */
export async function updatePlanMercadoPago(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ checked: boolean; detail: string | null }>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { code, mpPlanId } = parsed.data;

    let checked = false;
    let detail: string | null = null;
    if (mpPlanId && billingEnabled()) {
      const res = await verifyMpPlan(mpPlanId);
      if ("error" in res) return fail(res.error);
      checked = true;
      detail = res.detail;
    }

    const { error } = await supabase
      .from("plans")
      .update({ mp_plan_id: mpPlanId || null })
      .eq("code", code);
    if (error) return fail(error.message);
    revalidatePath("/platform/planes");
    revalidatePath("/admin/plan");
    return ok({ checked, detail });
  });
}

const yearlySchema = z.object({
  code: z.string().min(1),
  /** "" = sin pago anual. */
  priceYearly: z.union([z.literal(""), z.coerce.number().positive("El precio anual tiene que ser mayor que cero.").max(1e10)]),
  mpPlanIdYearly: mpPlanIdSchema,
});

/**
 * Pago anual del plan (0019): `plans.price_yearly` (vacío = sin anual) y
 * `plans.mp_plan_id_yearly` (plan de MercadoPago con frecuencia de 12 meses;
 * vacío = el anual con MercadoPago se crea sin plan asociado, con el precio
 * anual cada 12 meses). Con MP_ACCESS_TOKEN se verifica el plan de MP antes
 * de guardarlo, como el mensual, y además que cobre cada 12 meses.
 */
export async function updatePlanYearly(
  input: z.input<typeof yearlySchema>,
): Promise<ActionResult<{ checked: boolean; detail: string | null }>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const parsed = yearlySchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { code, priceYearly, mpPlanIdYearly } = parsed.data;
    if (mpPlanIdYearly && priceYearly === "") return fail("Cargá el precio anual para usar un plan anual de MercadoPago.");

    let checked = false;
    let detail: string | null = null;
    if (mpPlanIdYearly && billingEnabled()) {
      const res = await verifyMpPlan(mpPlanIdYearly, (mp) => {
        const ar = mp.auto_recurring;
        if (!ar) return null;
        if (!(Number(ar.frequency) === 12 && ar.frequency_type === "months")) {
          return `Ese plan de MercadoPago cobra cada ${ar.frequency ?? "?"} ${ar.frequency_type ?? "?"}: el anual tiene que cobrar cada 12 meses.`;
        }
        // Lo que cobra MP tiene que ser lo que ve el dueño en /planes y /admin/plan.
        if (typeof ar.transaction_amount === "number" && typeof priceYearly === "number" && Math.abs(ar.transaction_amount - priceYearly) > 0.005) {
          return `Ese plan de MercadoPago cobra ${ar.transaction_amount} y el precio anual es ${priceYearly}: igualalos antes de guardar.`;
        }
        return null;
      });
      if ("error" in res) return fail(res.error);
      checked = true;
      detail = res.detail;
    }

    const { error } = await supabase
      .from("plans")
      .update({ price_yearly: priceYearly === "" ? null : priceYearly, mp_plan_id_yearly: mpPlanIdYearly || null })
      .eq("code", code);
    if (error) return fail(error.message);
    revalidateTag(PLANS_TAG, "max");
    revalidatePath("/platform/planes");
    revalidatePath("/admin/plan");
    return ok({ checked, detail });
  });
}
