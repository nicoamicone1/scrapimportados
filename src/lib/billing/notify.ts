import "server-only";

import { isEmail, platformFrom, sendEmail } from "@/lib/email/send";
import { planActivatedEmail, planPaymentFailedEmail } from "@/lib/email/templates/billing";
import { PLAN_NAMES, type PlanCode } from "@/lib/plans";
import { platformOrigin, storeUrl } from "@/lib/tenant/urls";

import type { BillingDb } from "./service";
import type { SyncResult } from "./sync";

const GRACE_DAYS = 7;

/**
 * Mail al dueño según la decisión (activado / no pudimos cobrar). Nunca lanza.
 * Idempotencia: `Idempotency-Key` de Resend por tienda + preapproval + período
 * (o cobro), así un reintento del webhook no duplica el mail.
 */
export async function sendBillingEmail(db: BillingDb, result: SyncResult): Promise<void> {
  if (result.outcome !== "applied" || !result.decision.email) return;
  const { storeId, preapprovalId, decision } = result;
  try {
    const { data: store } = await db
      .from("stores")
      .select("id, slug, name, owner_id, custom_domain, custom_domain_verified")
      .eq("id", storeId)
      .maybeSingle();
    if (!store?.owner_id) return;
    const [{ data: profile }, auth] = await Promise.all([
      db.from("profiles").select("email, name").eq("id", store.owner_id).maybeSingle(),
      db.auth.admin.getUserById(store.owner_id).catch(() => null),
    ]);
    const to = [auth?.data.user?.email, profile?.email].find(isEmail);
    if (!to) return;
    const { data: plan } = await db.from("plans").select("name").eq("code", decision.planCode).maybeSingle();
    const planName = plan?.name ?? PLAN_NAMES[decision.planCode as PlanCode] ?? decision.planCode;
    const support = process.env.PLATFORM_EMAIL?.trim();
    const base = {
      storeName: store.name,
      storeUrl: storeUrl(store),
      platformUrl: platformOrigin(),
      ownerName: profile?.name ?? null,
      supportEmail: isEmail(support) ? support : null,
    };
    const periodEnd = decision.periodEnd ?? result.previous.current_period_end;
    const content =
      decision.email === "activated"
        ? planActivatedEmail({ ...base, planName, periodEnd })
        : planPaymentFailedEmail({
            ...base,
            planName,
            graceUntil: periodEnd ? new Date(new Date(periodEnd).getTime() + GRACE_DAYS * 86_400_000).toISOString() : null,
          });
    const ref = decision.email === "activated" ? periodEnd ?? "sin-periodo" : result.paymentId ?? periodEnd ?? "sin-periodo";
    await sendEmail({
      to,
      from: platformFrom(),
      replyTo: base.supportEmail,
      ...content,
      tags: [
        { name: "kind", value: decision.email === "activated" ? "plan_activated" : "plan_payment_failed" },
        { name: "store", value: store.slug },
      ],
      idempotencyKey: `billing/${decision.email}/${storeId}/${preapprovalId}/${ref}`,
    });
  } catch (err) {
    console.error("[billing] mail:", err instanceof Error ? err.message : err);
  }
}
