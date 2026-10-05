/**
 * "Resolver desde acá" (Inicio del panel, PRODUCT-THESIS §4.1): qué pedidos
 * entran en la cola de trabajo del inicio y en qué orden. Lógica pura,
 * testeada en `work-queue.test.ts`. Sin dependencias de server ni de React:
 * la usan `getWorkQueue` (server) y `WorkQueue` (cliente).
 */

import type { OrderListItem } from "@/lib/admin/orders";
import type { WhatsAppMessageContext, WhatsAppTemplateKind } from "@/lib/admin/whatsapp";

/** Estados que piden una acción del comerciante desde el inicio. */
export const WORK_QUEUE_STATUSES = ["pending", "confirmed", "preparing"] as const;
export type WorkQueueStatus = (typeof WORK_QUEUE_STATUSES)[number];

/** Cuántas filas muestra el inicio (el resto, en Pedidos). */
export const WORK_QUEUE_LIMIT = 8;

export function isWorkQueueStatus(status: string): status is WorkQueueStatus {
  return (WORK_QUEUE_STATUSES as readonly string[]).includes(status);
}

/** Lo mínimo que la priorización necesita de un pedido. */
export interface WorkQueueCandidate {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  paymentStatus: string;
}

export type WorkQueueGroup = "confirm" | "fulfil";

export const WORK_QUEUE_GROUP_LABELS: Record<WorkQueueGroup, string> = {
  confirm: "Por confirmar",
  fulfil: "Por preparar y despachar",
};

export function workQueueGroup(status: string): WorkQueueGroup {
  return status === "pending" ? "confirm" : "fulfil";
}

function time(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Reserva viva: pendiente, sin pagar y con vencimiento (se cancela sola). */
function reservationEnd(o: WorkQueueCandidate): number {
  return o.status === "pending" && o.paymentStatus === "pending" ? time(o.expiresAt) : Number.POSITIVE_INFINITY;
}

/**
 * Ordena la cola: primero los pendientes (por confirmar), después los
 * confirmados y en preparación. Dentro de los pendientes van antes las
 * reservas que vencen primero (si vencen, se cancelan solas); el resto, del
 * más viejo al más nuevo, porque es el que más espera. Descarta lo que no
 * está en un estado accionable y deja `limit` filas.
 */
export function prioritizeWorkQueue<T extends WorkQueueCandidate>(items: readonly T[], limit: number = WORK_QUEUE_LIMIT): T[] {
  const seen = new Set<string>();
  return items
    .filter((o) => {
      if (!isWorkQueueStatus(o.status) || seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    })
    .sort((a, b) => {
      const g = (workQueueGroup(a.status) === "confirm" ? 0 : 1) - (workQueueGroup(b.status) === "confirm" ? 0 : 1);
      if (g) return g;
      const ra = reservationEnd(a);
      const rb = reservationEnd(b);
      if (ra !== rb) return ra < rb ? -1 : 1;
      const ca = time(a.createdAt);
      const cb = time(b.createdAt);
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, Math.max(0, limit));
}

/** Agrupa la cola ya ordenada para pintarla con subtítulos (sin grupos vacíos). */
export function groupWorkQueue<T extends { status: string }>(items: readonly T[]): { group: WorkQueueGroup; items: T[] }[] {
  const groups: { group: WorkQueueGroup; items: T[] }[] = [];
  for (const item of items) {
    const g = workQueueGroup(item.status);
    const last = groups[groups.length - 1];
    if (last && last.group === g) last.items.push(item);
    else groups.push({ group: g, items: [item] });
  }
  return groups;
}

/**
 * Línea de la cabecera del inicio. Con pendientes: "Tenés 7 cosas para
 * resolver". Sin pendientes y con pedidos: "Listo por hoy". Sin pedidos
 * todavía: null (la cabecera muestra su propio mensaje de arranque).
 */
export function todoHeadline(total: number, hasOrders: boolean): string | null {
  const n = Math.max(0, Math.floor(total));
  if (n > 0) return `Tenés ${n.toLocaleString("es-AR")} ${n === 1 ? "cosa" : "cosas"} para resolver`;
  return hasOrders ? "Listo por hoy" : null;
}

/** Datos para "Avisar por WhatsApp" desde la fila (null si no hay un teléfono válido). */
export interface WorkQueueWhatsApp {
  phone: string;
  kind: WhatsAppTemplateKind;
  context: WhatsAppMessageContext;
}

/** Fila de la cola: el pedido del listado + lo necesario para avisar por WhatsApp. */
export interface WorkQueueItem extends OrderListItem {
  /** null si el pedido no tiene un teléfono válido para WhatsApp. */
  whatsApp: WorkQueueWhatsApp | null;
}
