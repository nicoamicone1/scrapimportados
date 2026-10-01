import { nextStatus, statusActionLabel, type OrderStatus } from "@/lib/admin/order-utils";

/**
 * Acción rápida de una fila/tarjeta de pedido: el paso natural siguiente, en
 * un toque. Lógica pura (testeada en `quick-action.test.ts`).
 *
 * - Pedido pendiente, sin pagar y por transferencia: "Confirmar pago" (registra
 *   el saldo como pagado y confirma el pedido, que es lo que hace el comerciante
 *   cuando le llega el comprobante).
 * - Resto: siguiente estado del flujo (confirmar → preparar → enviar → entregar).
 */
export type QuickAction =
  | { kind: "confirm_payment"; label: string }
  | { kind: "status"; to: OrderStatus; label: string; needsTracking: boolean };

export interface QuickActionInput {
  status: string;
  paymentStatus: string;
  fulfillment: string;
  paymentMethodCode: string | null;
}

export function quickActionFor(o: QuickActionInput): QuickAction | null {
  const status = o.status as OrderStatus;
  if (status === "cancelled" || status === "delivered") return null;
  const unpaid = o.paymentStatus === "pending" || o.paymentStatus === "partial";
  if (status === "pending" && unpaid && o.paymentMethodCode === "transfer") {
    return { kind: "confirm_payment", label: "Confirmar pago" };
  }
  const to = nextStatus(status);
  if (!to) return null;
  return {
    kind: "status",
    to,
    label: statusActionLabel(to, o.fulfillment, status),
    needsTracking: to === "shipped" && o.fulfillment !== "pickup",
  };
}
