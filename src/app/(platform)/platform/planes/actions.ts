"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { billingEnabled, getPreapprovalPlan, MercadoPagoError } from "@/lib/billing/mercadopago";

const schema = z.object({
  code: z.string().min(1),
  mpPlanId: z
    .string()
    .trim()
    .max(80)
    .regex(/^[A-Za-z0-9_-]*$/, "Pegá sólo el id del plan de MercadoPago (letras y números)."),
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
      try {
        const mp = await getPreapprovalPlan(mpPlanId);
        checked = true;
        const ar = mp.auto_recurring;
        detail = [mp.reason, ar?.transaction_amount ? `${ar.currency_id ?? ""} ${ar.transaction_amount} cada ${ar.frequency ?? 1} ${ar.frequency_type ?? "months"}` : null, mp.status]
          .filter(Boolean)
          .join(" · ");
        if (mp.status && mp.status !== "active") return fail(`Ese plan de MercadoPago está ${mp.status}: activalo en MercadoPago antes de usarlo.`);
      } catch (err) {
        if (err instanceof MercadoPagoError && err.status === 404) return fail("MercadoPago no encuentra ese plan. Revisá el id.");
        if (err instanceof MercadoPagoError) {
          console.error("[billing]", err.message);
          return fail("No pudimos verificar el plan en MercadoPago. Probá de nuevo en unos minutos.");
        }
        throw err;
      }
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
