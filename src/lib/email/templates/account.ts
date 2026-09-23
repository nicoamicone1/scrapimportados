import { formatDate } from "@/lib/dates";
import { PLAN_DEFAULTS } from "@/lib/plans/features";

import { renderEmail, type EmailContent } from "../layout";
import { accountFooter, platformBrand, plural } from "./shared";

/*
 * Mails de CUENTA (al dueño de la tienda). Los firma Ecommy; el reply-to es
 * `PLATFORM_EMAIL` si está configurado.
 */

export interface AccountEmailBase {
  storeName: string;
  /** Home pública de la tienda. */
  storeUrl: string;
  /** Origen de la plataforma (`https://www.ecommy.app`). */
  platformUrl: string;
  ownerName?: string | null;
  /** Email de soporte de la plataforma (pie). */
  supportEmail?: string | null;
}

function hello(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? `Hola, ${first}.` : "Hola.";
}

// ---------------------------------------------------------------------------
// Bienvenida
// ---------------------------------------------------------------------------

export interface WelcomeEmailData extends AccountEmailBase {
  trialEndsAt?: string | null;
}

export function welcomeEmail(d: WelcomeEmailData): EmailContent {
  const host = d.storeUrl.replace(/^https?:\/\//, "");
  const panel = `${d.platformUrl}/admin`;
  const subject = `${d.storeName} ya está creada`;
  return renderEmail({
    subject,
    preheader: `Tu tienda vive en ${host}. Tres pasos para recibir el primer pedido.`,
    brand: platformBrand(d.platformUrl),
    blocks: [
      { t: "heading", text: subject },
      { t: "p", content: [hello(d.ownerName), " Tu tienda ya tiene dirección: ", { href: d.storeUrl, label: host }, "."] },
      d.trialEndsAt && {
        t: "p",
        content: [
          "Tenés el plan Pro gratis hasta el ",
          { b: formatDate(d.trialEndsAt) },
          ", sin tarjeta. Después elegís un plan o seguís en Free sin perder nada.",
        ],
      },
      { t: "section", title: "Para recibir el primer pedido" },
      {
        t: "list",
        ordered: true,
        items: [
          [{ href: `${d.platformUrl}/admin/productos/nuevo`, label: "Cargá tus productos" }, ": con foto, precio y stock. También podés importarlos desde una planilla o desde otra tienda online."],
          [{ href: `${d.platformUrl}/admin/configuracion/pagos`, label: "Definí cómo cobrás" }, " (CBU o alias, WhatsApp) y ", { href: `${d.platformUrl}/admin/envios`, label: "cómo entregás" }, " (zonas de envío o retiro en el local)."],
          [{ href: `${d.platformUrl}/admin/configuracion/tienda`, label: "Cargá el email de contacto de la tienda" }, ": ahí te avisamos cada pedido nuevo."],
        ],
      },
      { t: "button", href: panel, label: "Abrir el panel" },
      { t: "p", content: ["Cuando esté lista, compartí el link: ", { href: d.storeUrl, label: host }, "."], muted: true },
    ],
    footer: accountFooter(d.platformUrl, d.supportEmail ?? null),
  });
}

// ---------------------------------------------------------------------------
// Prueba de Pro
// ---------------------------------------------------------------------------

/** Qué queda limitado en Free (según `PLAN_DEFAULTS`, espejo de la tabla `plans`). */
export function freePlanRestrictions(): string[] {
  const free = PLAN_DEFAULTS.free;
  return [
    `Hasta ${free.limits.products} productos y ${free.limits.images_per_product} fotos por producto.`,
    free.limits.pages === 1 ? "Una sola página: la de inicio." : `Hasta ${free.limits.pages} páginas.`,
    "Sin promociones programadas ni cambios masivos de precios.",
    "Sin importar catálogos desde planillas ni desde otra web.",
    "Sin dominio propio, equipo, auditoría ni Google Analytics / Meta Pixel.",
  ];
}

export interface TrialEndingEmailData extends AccountEmailBase {
  trialEndsAt: string;
  daysLeft: number;
}

export function trialEndingEmail(d: TrialEndingEmailData): EmailContent {
  const days = Math.max(1, Math.round(d.daysLeft));
  const when = days === 1 ? "mañana" : `en ${plural(days, "día", "días")}`;
  const subject = `Tu prueba de Pro termina ${when}`;
  return renderEmail({
    subject,
    preheader: `El ${formatDate(d.trialEndsAt)} ${d.storeName} pasa a Free si no elegís un plan.`,
    brand: platformBrand(d.platformUrl),
    blocks: [
      { t: "heading", text: subject },
      {
        t: "p",
        content: [
          hello(d.ownerName),
          ` La prueba de Pro de ${d.storeName} termina el `,
          { b: formatDate(d.trialEndsAt) },
          ". Si no elegís un plan, la tienda pasa a Free: no se borra nada, pero lo que excede Free queda bloqueado.",
        ],
      },
      { t: "section", title: "Qué cambia en Free" },
      { t: "list", items: freePlanRestrictions() },
      { t: "button", href: `${d.platformUrl}/admin/plan`, label: "Elegir un plan" },
    ],
    footer: accountFooter(d.platformUrl, d.supportEmail ?? null),
  });
}

export interface TrialEndedEmailData extends AccountEmailBase {
  endedAt: string;
}

export function trialEndedEmail(d: TrialEndedEmailData): EmailContent {
  const subject = `Tu prueba terminó: ${d.storeName} pasó a Free`;
  return renderEmail({
    subject,
    preheader: "No se borró nada. Elegí un plan para recuperar lo bloqueado.",
    brand: platformBrand(d.platformUrl),
    blocks: [
      { t: "heading", text: "Tu prueba de Pro terminó" },
      {
        t: "p",
        content: [
          hello(d.ownerName),
          ` La prueba de Pro de ${d.storeName} terminó el `,
          { b: formatDate(d.endedAt) },
          " y la tienda pasó al plan Free. No se borró nada: tus productos, pedidos y clientes siguen ahí.",
        ],
      },
      { t: "section", title: "Qué cambia en Free" },
      { t: "list", items: freePlanRestrictions() },
      { t: "p", content: "Si elegís un plan, se desbloquea todo tal como lo dejaste." },
      { t: "button", href: `${d.platformUrl}/admin/plan`, label: "Ver los planes" },
    ],
    footer: accountFooter(d.platformUrl, d.supportEmail ?? null),
  });
}
