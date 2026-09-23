import { formatDate } from "@/lib/dates";
import { featureMinPlan, PLAN_DEFAULTS, PLAN_NAMES } from "@/lib/plans/features";

import { renderEmail, type EmailContent, type Inline } from "../layout";
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

// ---------------------------------------------------------------------------
// Activación (cron diario, src/lib/email/activation-notices.ts)
// ---------------------------------------------------------------------------

/** "desde Starter" según `PLAN_DEFAULTS` (la misma fuente que los candados del panel). */
function fromPlan(key: Parameters<typeof featureMinPlan>[0]): string {
  return PLAN_NAMES[featureMinPlan(key)];
}

export interface NoProductsEmailData extends AccountEmailBase {
  /** Días desde que se creó la tienda (entero, ≥ 2). */
  daysSinceCreated: number;
  /** Días que le quedan a la prueba de Pro (0 = no está en prueba). */
  trialDaysLeft?: number;
}

/** Día 2 sin productos: dos caminos concretos para cargar el primero. */
export function noProductsEmail(d: NoProductsEmailData): EmailContent {
  const host = d.storeUrl.replace(/^https?:\/\//, "");
  const days = Math.max(1, Math.round(d.daysSinceCreated));
  const trial = Math.max(0, Math.round(d.trialDaysLeft ?? 0));
  const csvPlan = fromPlan("catalog.import_csv");
  const webPlan = fromPlan("catalog.import_web");
  const heading = "Tu tienda está creada. Falta lo más importante: el primer producto.";
  const importNote: Inline[] = [` Planilla, desde el plan ${csvPlan}; otra web, desde ${webPlan}.`];
  if (trial > 0) {
    importNote.push(" ", { b: `Durante tu prueba de Pro (te ${trial === 1 ? "queda 1 día" : `quedan ${trial} días`}) tenés las dos.` });
  }
  return renderEmail({
    subject: `${d.storeName}: falta cargar el primer producto`,
    preheader: `Sin productos, quien entra a ${host} no puede pedir nada. Dos formas de cargar el primero.`,
    brand: platformBrand(d.platformUrl),
    blocks: [
      { t: "heading", text: heading },
      {
        t: "p",
        content: [
          hello(d.ownerName),
          ` Creaste ${d.storeName} hace ${plural(days, "día", "días")} y todavía no tiene productos: quien entra a `,
          { href: d.storeUrl, label: host },
          " ve la tienda vacía y no puede hacer un pedido.",
        ],
      },
      { t: "section", title: "Dos caminos" },
      {
        t: "list",
        ordered: true,
        items: [
          [
            { href: `${d.platformUrl}/admin/productos/nuevo`, label: "Cargar uno a mano" },
            ": nombre, precio, una foto y stock. Con uno solo ya podés ver cómo queda en la tienda.",
          ],
          [
            { href: `${d.platformUrl}/admin/importar`, label: "Importar el catálogo" },
            ": desde una planilla CSV o desde la web donde ya vendés.",
            ...importNote,
          ],
        ],
      },
      { t: "button", href: `${d.platformUrl}/admin/productos/nuevo`, label: "Cargar el primer producto" },
      d.supportEmail && {
        t: "p",
        content: "Si preferís que lo hagamos juntos, respondé este mail y coordinamos.",
        muted: true,
      },
    ],
    footer: accountFooter(d.platformUrl, d.supportEmail ?? null),
  });
}

export interface ShareStoreEmailData extends AccountEmailBase {
  /** Productos activos (publicados) de la tienda. */
  activeProducts: number;
  /** Fin de la prueba de Pro, si sigue en prueba. */
  trialEndsAt?: string | null;
  trialDaysLeft?: number;
}

/** Día 7 con productos, sin compartir ni pedidos: que el link llegue a los clientes. */
export function shareStoreEmail(d: ShareStoreEmailData): EmailContent {
  const host = d.storeUrl.replace(/^https?:\/\//, "");
  const products = Math.max(1, Math.round(d.activeProducts));
  const trial = Math.max(0, Math.round(d.trialDaysLeft ?? 0));
  const heading = "Tu tienda ya tiene productos. Ahora, que la vean.";
  return renderEmail({
    subject: heading,
    preheader: `${plural(products, "producto activo", "productos activos")} en ${host}. Falta que el link llegue a tus clientes.`,
    brand: platformBrand(d.platformUrl),
    blocks: [
      { t: "heading", text: heading },
      {
        t: "p",
        content: [
          hello(d.ownerName),
          ` ${d.storeName} tiene `,
          { b: plural(products, "producto activo", "productos activos") },
          " y todavía no recibió pedidos. Lo que falta es que el link llegue a quien ya te compra.",
        ],
      },
      { t: "p", content: ["Dirección de tu tienda: ", { href: d.storeUrl, label: host }] },
      { t: "section", title: "Dónde compartirla" },
      {
        t: "list",
        items: [
          "Por WhatsApp, a tus clientes y en tu estado, con un mensaje ya escrito.",
          "En la bio de Instagram y en una historia con el link.",
          "En el local: el código QR impreso en el mostrador, las bolsas o las etiquetas.",
          "Cuando te pregunten por algo puntual, el link directo a ese producto.",
        ],
      },
      { t: "button", href: `${d.platformUrl}/admin/compartir`, label: "Ver link, QR y mensajes" },
      trial > 0 &&
        d.trialEndsAt && {
          t: "p",
          content: [
            `Tu prueba de Pro sigue hasta el `,
            { b: formatDate(d.trialEndsAt) },
            ` (${trial === 1 ? "queda 1 día" : `quedan ${trial} días`}): buen momento para recibir los primeros pedidos con todo habilitado.`,
          ],
          muted: true,
        },
    ],
    footer: accountFooter(d.platformUrl, d.supportEmail ?? null),
  });
}
