"use server";

import { z } from "zod";

import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { PLAN_CODES, PLAN_NAMES, type PlanCode } from "@/lib/plans";
import { storeDisplayHost } from "@/lib/tenant/urls";

/**
 * "Quiero este plan": registra el pedido en auditoría y devuelve el link de
 * WhatsApp de la plataforma con el mensaje armado. El cobro automático
 * (MercadoPago) queda para v0.2 (docs/BILLING.md).
 */
export async function requestUpgrade(input: { plan: string }): Promise<ActionResult<{ url: string | null }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = z.object({ plan: z.enum(PLAN_CODES) }).safeParse(input);
    if (!parsed.success) return fail("Plan inválido.");
    const plan = parsed.data.plan as PlanCode;
    if (plan === ctx.plan.code) return fail("Ya estás en ese plan.");

    await logAudit(ctx, {
      action: "plan.upgrade_request",
      entity: "subscription",
      entityId: ctx.store.id,
      summary: `Pidió pasar de ${ctx.plan.name} a ${PLAN_NAMES[plan]}`,
      diff: { plan: [ctx.plan.code, plan] },
    });

    const phone = (process.env.PLATFORM_WHATSAPP ?? "").replace(/\D/g, "");
    if (!phone) return ok<{ url: string | null }>({ url: null });
    const text = [
      `Hola! Quiero pasar mi tienda al plan ${PLAN_NAMES[plan]}.`,
      "",
      `Tienda: ${ctx.store.name} (${storeDisplayHost(ctx.store)})`,
      `Plan actual: ${ctx.plan.name}${ctx.plan.status === "trialing" ? " (prueba)" : ""}`,
      `Cuenta: ${ctx.user.email ?? ""}`,
    ].join("\n");
    return ok<{ url: string | null }>({ url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` });
  });
}
