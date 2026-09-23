import { formatDate } from "@/lib/dates";

import { renderEmail, type EmailContent } from "../layout";
import type { AccountEmailBase } from "./account";
import { accountFooter, platformBrand } from "./shared";

/*
 * Mails de COBRO del plan (al dueño). Los firma Ecommy. Se mandan desde el
 * webhook de MercadoPago (src/lib/billing/notify.ts).
 */

function hello(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first && /^[\p{L}'’-]{1,30}$/u.test(first) ? `Hola, ${first}.` : "Hola.";
}

export interface PlanActivatedEmailData extends AccountEmailBase {
  planName: string;
  /** Fin del período pago (próximo cobro). */
  periodEnd: string | null;
}

export function planActivatedEmail(d: PlanActivatedEmailData): EmailContent {
  const until = d.periodEnd ? formatDate(d.periodEnd) : null;
  const subject = until ? `Tu plan ${d.planName} está activo hasta el ${until}` : `Tu plan ${d.planName} está activo`;
  return renderEmail({
    subject,
    preheader: `Cobramos el plan ${d.planName} de ${d.storeName} con MercadoPago. Se renueva solo cada mes.`,
    brand: platformBrand(d.platformUrl),
    blocks: [
      { t: "heading", text: `Tu plan ${d.planName} está activo` },
      {
        t: "p",
        content: [
          hello(d.ownerName),
          ` MercadoPago confirmó la suscripción de ${d.storeName}: ya tenés todo lo del plan ${d.planName}`,
          until ? [" hasta el ", { b: until }, ", y se renueva solo ese día."] : ".",
        ].flat(),
      },
      {
        t: "rows",
        rows: [
          { label: "Tienda", value: d.storeName },
          { label: "Plan", value: d.planName },
          ...(until ? [{ label: "Próximo cobro", value: until }] : []),
          { label: "Medio de pago", value: "MercadoPago (débito automático)" },
        ],
      },
      { t: "button", href: `${d.platformUrl}/admin/plan`, label: "Ver el plan" },
      {
        t: "p",
        muted: true,
        content: "Podés cancelar la renovación cuando quieras desde Plan en el panel: el plan sigue activo hasta el final del período pago.",
      },
    ],
    footer: accountFooter(d.platformUrl, d.supportEmail ?? null),
  });
}

export interface PlanPaymentFailedEmailData extends AccountEmailBase {
  planName: string;
  /** Hasta cuándo se mantiene el plan si no se regulariza (fin del período + 7 días). */
  graceUntil: string | null;
}

export function planPaymentFailedEmail(d: PlanPaymentFailedEmailData): EmailContent {
  const subject = `No pudimos cobrar tu plan ${d.planName}`;
  const grace = d.graceUntil ? formatDate(d.graceUntil) : null;
  return renderEmail({
    subject,
    preheader: "Revisá el medio de pago en MercadoPago para que la tienda no pase a Free.",
    brand: platformBrand(d.platformUrl),
    blocks: [
      { t: "heading", text: subject },
      {
        t: "p",
        content: [
          hello(d.ownerName),
          ` MercadoPago no pudo cobrar el plan ${d.planName} de ${d.storeName}. Revisá el medio de pago en la sección Suscripciones de tu cuenta de MercadoPago (tarjeta vencida, sin fondos o sin límite): MercadoPago reintenta el cobro solo.`,
        ],
      },
      grace && {
        t: "p",
        content: ["Si el cobro no entra, el ", { b: grace }, " la tienda pasa a Free. No se borra nada: lo que excede Free queda bloqueado."],
      },
      { t: "button", href: `${d.platformUrl}/admin/plan`, label: "Ver el estado del plan" },
    ],
    footer: accountFooter(d.platformUrl, d.supportEmail ?? null),
  });
}
