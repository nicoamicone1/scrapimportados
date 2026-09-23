"use server";

import { z } from "zod";

import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { notifyPlanRequest } from "@/lib/email/notify";
import { PLAN_CODES, PLAN_NAMES, type PlanCode } from "@/lib/plans";
import { storeDisplayHost } from "@/lib/tenant/urls";

/**
 * "Quiero este plan": registra el pedido en auditoría y devuelve el link de
 * WhatsApp de la plataforma con el mensaje armado. El cobro automático
 * (MercadoPago) queda para v0.2 (docs/BILLING.md).
 *
 * Sólo dueño o administrador: el staff no decide el plan (y cada pedido manda
 * un mail a la casilla de la plataforma).
 */
export async function requestUpgrade(input: { plan: string }): Promise<ActionResult<{ url: string | null }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
      return fail("Sólo el dueño o un administrador de la tienda puede pedir un cambio de plan.");
    }
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
    // Aviso interno a la plataforma (si hay PLATFORM_EMAIL), además del WhatsApp.
    notifyPlanRequest({
      store: ctx.store,
      currentPlan: ctx.plan.name,
      currentTrial: ctx.plan.status === "trialing",
      requestedPlanCode: plan,
      requestedPlan: PLAN_NAMES[plan],
      requestedBy: ctx.user.email,
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
