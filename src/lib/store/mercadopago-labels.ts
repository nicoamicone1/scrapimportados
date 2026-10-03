/**
 * Textos para mostrar un pago de Mercado Pago (storefront y admin). Sin
 * logos ni marcas gráficas: sólo el nombre del medio en texto. Sirve en
 * cliente y servidor (no importa nada server-only).
 */

export interface MpPaymentDetailView {
  status: string;
  statusDetail: string | null;
  installments: number | null;
  paymentMethodId: string | null;
  lastFour: string | null;
}

/** `payment_method_id` de MP → nombre legible. Lo desconocido se muestra capitalizado. */
const METHOD_NAMES: Record<string, string> = {
  visa: "Visa",
  master: "Mastercard",
  amex: "American Express",
  naranja: "Naranja X",
  cabal: "Cabal",
  maestro: "Maestro",
  debvisa: "Visa Débito",
  debmaster: "Mastercard Débito",
  debcabal: "Cabal Débito",
  cencosud: "Cencosud",
  argencard: "Argencard",
  tarshop: "Tarjeta Shopping",
  diners: "Diners",
  cmr: "CMR",
  cordobesa: "Cordobesa",
  account_money: "dinero en Mercado Pago",
  consumer_credits: "Cuotas sin tarjeta de Mercado Pago",
  rapipago: "Rapipago",
  pagofacil: "Pago Fácil",
};

export function mpMethodName(id: string | null | undefined): string | null {
  if (!id) return null;
  const known = METHOD_NAMES[id.toLowerCase()];
  if (known) return known;
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");
}

/** "Visa ••4242 en 6 cuotas" · "Visa Débito ••1234" · "dinero en Mercado Pago". */
export function mpPaymentSummary(d: Pick<MpPaymentDetailView, "paymentMethodId" | "lastFour" | "installments">): string | null {
  const name = mpMethodName(d.paymentMethodId);
  if (!name) return null;
  const card = d.lastFour ? `${name} ••${d.lastFour}` : name;
  const n = d.installments ?? 0;
  return n > 1 ? `${card} en ${n} cuotas` : card;
}

export type MpStatusKind = "approved" | "review" | "rejected" | "refunded" | "unknown";

/** Agrupa los estados de MP en lo que le importa a quien mira. */
export function mpStatusKind(status: string | null | undefined): MpStatusKind {
  switch (status) {
    case "approved":
    case "authorized":
      return "approved";
    case "pending":
    case "in_process":
    case "in_mediation":
      return "review";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "refunded":
    case "charged_back":
      return "refunded";
    default:
      return "unknown";
  }
}

/** Estado de MP → etiqueta corta (admin). */
export function mpStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "approved":
      return "Aprobado";
    case "authorized":
      return "Autorizado";
    case "pending":
      return "Pendiente";
    case "in_process":
      return "En revisión";
    case "in_mediation":
      return "En disputa";
    case "rejected":
      return "Rechazado";
    case "cancelled":
      return "Cancelado";
    case "refunded":
      return "Devuelto";
    case "charged_back":
      return "Contracargo";
    default:
      return status ? status : "Sin datos";
  }
}

/**
 * `status_detail` de un pago rechazado o en revisión → qué pasó y cómo seguir,
 * en voseo, para el comprador. null si no hay nada útil para decir.
 */
export function mpStatusDetailText(detail: string | null | undefined): string | null {
  switch (detail) {
    case "cc_rejected_insufficient_amount":
      return "La tarjeta no tiene saldo o límite suficiente. Probá con otra tarjeta o en menos cuotas.";
    case "cc_rejected_bad_filled_security_code":
      return "El código de seguridad no coincide. Revisalo en el dorso de la tarjeta y probá de nuevo.";
    case "cc_rejected_bad_filled_date":
      return "La fecha de vencimiento no coincide. Revisala y probá de nuevo.";
    case "cc_rejected_bad_filled_card_number":
      return "El número de tarjeta no es correcto. Revisalo y probá de nuevo.";
    case "cc_rejected_bad_filled_other":
      return "Algún dato de la tarjeta no es correcto. Revisalos y probá de nuevo.";
    case "cc_rejected_call_for_authorize":
      return "Tu banco tiene que autorizar este pago. Llamalo, autorizalo y probá de nuevo.";
    case "cc_rejected_card_disabled":
      return "La tarjeta no está activada. Activala con tu banco o usá otra.";
    case "cc_rejected_duplicated_payment":
      return "Ya hiciste un pago igual hace un momento. Si tenés que pagar de nuevo, usá otra tarjeta.";
    case "cc_rejected_high_risk":
    case "rejected_high_risk":
      return "Mercado Pago no aprobó el pago por seguridad. Probá con otra tarjeta o con dinero en tu cuenta.";
    case "cc_rejected_max_attempts":
      return "Llegaste al límite de intentos con esta tarjeta. Probá con otra.";
    case "cc_rejected_invalid_installments":
      return "La tarjeta no acepta esa cantidad de cuotas. Probá con menos cuotas.";
    case "cc_rejected_card_error":
    case "cc_rejected_other_reason":
    case "cc_rejected_blacklist":
      return "La tarjeta fue rechazada. Probá con otra tarjeta o con otro medio de pago.";
    case "expired":
      return "El pago venció antes de completarse.";
    case "pending_contingency":
    case "pending_review_manual":
      return "Mercado Pago está revisando el pago. Suele resolverse en minutos, a veces hasta 48 h.";
    case "pending_waiting_payment":
    case "pending_waiting_transfer":
      return "Falta que completes el pago (cupón o transferencia) desde lo que te indicó Mercado Pago.";
    default:
      return null;
  }
}
