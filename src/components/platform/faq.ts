/*
 * Preguntas frecuentes de la plataforma: una sola fuente para la landing,
 * /planes y /contacto, así no se contradicen. Cada página elige cuáles
 * muestra con `pickFaq`. Todo lo que se afirma acá tiene que ser cierto en
 * el producto (features y límites en `src/lib/plans/features.ts`). Los
 * "desde qué plan" salen de los planes de la base (`plan-notes`).
 */

import type { PlanInfo } from "@/lib/plans";
import { validYearlyOffer, yearlyMonthsPaid } from "@/lib/plans/yearly";

import { minPlanName, type PlanLike } from "./plan-notes";

export type FaqId =
  | "comision"
  | "tarjeta"
  | "prueba"
  | "cambio-plan"
  | "anual"
  | "varias-tiendas"
  | "mudanza"
  | "dominio"
  | "datos"
  | "facturacion";

export interface FaqItem {
  id: FaqId;
  q: string;
  a: string;
}

/** Plan para la FAQ: con `priceYearly` (0019) arma la respuesta del pago anual. */
export type FaqPlan = PlanLike & Partial<Pick<PlanInfo, "priceYearly">>;

export interface FaqContext {
  /** Dirección de ejemplo de una tienda en este entorno (`exampleStoreAddress()`). */
  storeAddress: string;
  /** Planes públicos (`listPublicPlans`); vacío o ausente = defaults del código. */
  plans?: readonly FaqPlan[];
  /**
   * El cobro con MercadoPago está prendido (`billingEnabled()`, sólo servidor).
   * Sin él (default), la FAQ no promete MercadoPago: cambio de plan y pago
   * anual se piden por WhatsApp y se pagan por transferencia.
   */
  mpEnabled?: boolean;
}

/** "Starter" · "Starter y Pro" · "Starter, Pro y Business". */
function joinNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/**
 * Respuesta de "¿Puedo pagar el año?" a partir de los planes con un anual que
 * se puede ofrecer (`validYearlyOffer`); `null` si ninguno lo tiene (la
 * pregunta no se muestra). Sin porcentajes (la FAQ no promete cifras sueltas):
 * "12 meses por el precio de N" sólo si es el mismo N en todos.
 */
function yearlyAnswer(plans: readonly FaqPlan[], mpEnabled: boolean): string | null {
  const yearly = plans.filter((p) => validYearlyOffer(p.priceMonthly ?? null, p.priceYearly ?? null) !== null);
  if (!yearly.length) return null;
  const months = new Set(yearly.map((p) => yearlyMonthsPaid(p.priceMonthly ?? null, p.priceYearly ?? null)));
  const [n] = months;
  const deal = months.size === 1 && n !== null && n !== undefined ? `pagás 12 meses por el precio de ${n}` : "pagás el año por adelantado, con descuento";
  const how = mpEnabled ? "por transferencia o con MercadoPago" : "por transferencia";
  const renew = mpEnabled ? " Se renueva al año; con MercadoPago cancelás la renovación cuando quieras desde Plan en el panel." : " Se renueva al año.";
  return `Sí, en ${joinNames(yearly.map((p) => p.name))}: ${deal}, ${how}, y ese precio queda fijo durante el año.${renew}`;
}

export function platformFaq({ storeAddress, plans = [], mpEnabled = false }: FaqContext): FaqItem[] {
  const yearly = yearlyAnswer(plans, mpEnabled);
  const webPlan = minPlanName(plans, "catalog.import_web") ?? "Pro";
  const csvPlan = minPlanName(plans, "catalog.import_csv") ?? "Starter";
  const domainPlan = minPlanName(plans, "domain.custom") ?? "Pro";
  const exportPlan = minPlanName(plans, "orders.export") ?? "Pro";
  return [
    {
      id: "comision",
      q: "¿Cobran comisión por venta?",
      a: "No. Pagás el plan y nada más. Tus clientes te pagan por transferencia o lo acuerdan con vos por WhatsApp: la plata va directo a tu cuenta y no pasa por Ecommy.",
    },
    {
      id: "tarjeta",
      q: "¿Mis clientes pueden pagar con tarjeta?",
      a: "No dentro de la tienda: Ecommy no tiene pasarela de pago. Si alguien quiere pagar con tarjeta, lo acuerdan por WhatsApp (por ejemplo, le mandás un link de pago de tu billetera). El pedido ya quedó registrado en tu panel y lo marcás como pagado cuando se acredita.",
    },
    {
      id: "prueba",
      q: "¿Qué pasa cuando termina la prueba de 14 días?",
      a: "Si no elegiste un plan pago, tu tienda pasa a Free. No se borra nada: los productos, pedidos y páginas quedan; lo que excede el plan (por ejemplo, más de 50 productos, sin contar los archivados) queda bloqueado para crear hasta que subas de plan.",
    },
    {
      id: "cambio-plan",
      q: "¿Puedo cambiar de plan cuando quiera?",
      a: `Sí. Desde el panel, en Plan, ${
        mpEnabled ? "pagás el plan con MercadoPago (débito automático) o lo pedís por WhatsApp y lo activamos en el día" : "lo pedís por WhatsApp y lo activamos en el día"
      }. Si bajás de plan, no se borra nada: lo que excede el plan nuevo queda bloqueado para crear.`,
    },
    ...(yearly ? [{ id: "anual" as const, q: "¿Puedo pagar el año?", a: yearly }] : []),
    {
      id: "varias-tiendas",
      q: "¿Puedo tener más de una tienda?",
      a: "Sí, hasta tres tiendas por cuenta, cada una con su plan, su equipo y su dirección.",
    },
    {
      id: "mudanza",
      q: "Ya vendo en otra plataforma. ¿Puedo pasar el catálogo?",
      a: `Sí. Si tu tienda actual es WooCommerce, Shopify u otra web que publica sus productos con datos estructurados, la importás pegando la dirección (plan ${webPlan}, incluido en la prueba). Si no, bajás una planilla y la subís en CSV (desde ${csvPlan}). Los productos entran como borrador, con fotos y variantes, y, si traés tu dominio (${domainPlan}), cargás redirecciones 301 para que las direcciones viejas sigan funcionando.`,
    },
    {
      id: "dominio",
      q: "¿Puedo usar mi propio dominio?",
      a: `Sí, desde el plan ${domainPlan}. Mientras tanto, tu tienda tiene su dirección en Ecommy, del estilo ${storeAddress}.`,
    },
    {
      id: "datos",
      q: "¿Qué pasa con mis datos si me voy?",
      a: `Son tuyos. Desde ${exportPlan} exportás productos, pedidos y clientes en CSV cuando quieras. En cualquier plan, si cerrás la cuenta, te mandamos una copia si la pedís dentro de los 30 días. El detalle está en los términos del servicio.`,
    },
    {
      id: "facturacion",
      q: "¿Ecommy factura por mí?",
      a: "No: facturás vos, como hoy. Lo que sí resuelve la tienda es lo que pide la ley para vender online: Data Fiscal de ARCA, precio sin impuestos nacionales y botón de arrepentimiento.",
    },
  ];
}

/** Las preguntas pedidas, en el orden pedido (ignora ids inexistentes). */
export function pickFaq(items: readonly FaqItem[], ids: readonly FaqId[]): FaqItem[] {
  return ids.flatMap((id) => items.find((f) => f.id === id) ?? []);
}
