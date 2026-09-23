import { z } from "zod";

/*
 * "Avisame cuando haya stock" (migración 0016): partes PURAS, sin server ni
 * base (las usan la server action pública, el helper del admin y los tests).
 *
 * - `stockAlertInputSchema` / `readStockAlertRpc`: validar el alta y traducir
 *   la respuesta de `create_stock_alert` (ok, ya anotado, cupo, sin migración).
 * - `pickAlertsToNotify`: a quién avisar después de subir stock.
 */

/** Cupos del RPC `create_stock_alert` (espejo de 0016, para textos y tests). */
export const STOCK_ALERT_LIMITS = { perEmailPerHour: 5, perIpPerDay: 20, perStorePerDay: 200 } as const;

/**
 * Mails por reposición (corren en serie dentro de `after()`, ~0,5 s cada uno).
 * Los que no entran quedan pendientes y salen en la próxima reposición de ese
 * producto (o se mandan a mano desde la bandeja).
 */
export const MAX_ALERT_EMAILS_PER_RUN = 20;

export const STOCK_ALERT_EMAIL_ERROR = "Revisá el email.";
export const STOCK_ALERT_UNAVAILABLE = "No pudimos anotarte. Probá de nuevo en un rato.";

const uuid = z.string().uuid();

export const stockAlertInputSchema = z
  .object({
    productId: uuid,
    variantId: uuid.nullable(),
    /** Honeypot: campo oculto de la ficha. Si viene con algo, es un bot. */
    website: z.string().max(500).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, STOCK_ALERT_EMAIL_ERROR)
      .regex(/^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/, STOCK_ALERT_EMAIL_ERROR),
  })
  .strict();

export type StockAlertInput = z.infer<typeof stockAlertInputSchema>;

/** Error de PostgREST / Postgres (lo mínimo que se lee). */
export interface DbError {
  code?: string | null;
  message?: string | null;
}

/**
 * ¿El error es porque la migración todavía no se aplicó? (tabla o función
 * inexistente, en el esquema de PostgREST o en Postgres).
 */
export function isMissingSchema(error: DbError | null | undefined): boolean {
  const code = error?.code ?? "";
  return code === "PGRST205" || code === "PGRST202" || code === "42P01" || code === "42883";
}

export type StockAlertOutcome = { ok: true; duplicate: boolean } | { ok: false; error: string };

/**
 * Respuesta de `create_stock_alert` → resultado para la UI. Los `raise
 * exception` del RPC (P0001) ya vienen redactados para el comprador (email
 * inválido, cupo, ya hay stock); cualquier otro error, o la función sin
 * aplicar, es un mensaje genérico.
 */
export function readStockAlertRpc(data: unknown, error: DbError | null | undefined): StockAlertOutcome {
  if (error) {
    if (error.code === "P0001" && error.message) return { ok: false, error: error.message };
    return { ok: false, error: STOCK_ALERT_UNAVAILABLE };
  }
  const r = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as { ok?: unknown; duplicate?: unknown };
  if (r.ok !== true) return { ok: false, error: STOCK_ALERT_UNAVAILABLE };
  return { ok: true, duplicate: r.duplicate === true };
}

// ---------------------------------------------------------------------------
// A quién avisar
// ---------------------------------------------------------------------------

export interface PendingAlert {
  id: string;
  email: string;
  productId: string;
  /** null = aviso por el producto entero. */
  variantId: string | null;
  createdAt: string;
}

export interface AlertVariant {
  id: string;
  productId: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  isActive: boolean;
  position: number;
  product: { id: string; name: string; slug: string; status: string };
}

/** Un mail: una persona, un producto, las variantes que volvieron (≥ 1). */
export interface AlertNotice {
  email: string;
  product: AlertVariant["product"];
  variants: AlertVariant[];
  alertIds: string[];
}

/** Se puede comprar ahora (mismo criterio que el storefront y que 0016). */
export function variantAvailable(v: Pick<AlertVariant, "stock" | "trackInventory" | "allowBackorder" | "isActive">): boolean {
  return v.isActive && (!v.trackInventory || v.allowBackorder || v.stock > 0);
}

/**
 * Avisos pendientes + estado actual de las variantes → mails a mandar.
 *
 * - Aviso por variante: sale si esa variante se puede comprar.
 * - Aviso por producto (`variantId` null): sale si alguna variante del
 *   producto se puede comprar; el mail nombra las que volvieron.
 * - Producto no publicado: no sale nada (queda pendiente).
 * - Una persona con varios avisos del mismo producto recibe UN mail; todos
 *   esos avisos se marcan juntos.
 * - Orden: los avisos más viejos primero; como mucho `limit` mails.
 *
 * `variants`: todas las variantes de los productos tocados (el helper del
 * admin las carga); un aviso por una variante que no está en la lista no sale.
 */
export function pickAlertsToNotify(alerts: PendingAlert[], variants: AlertVariant[], limit = MAX_ALERT_EMAILS_PER_RUN): AlertNotice[] {
  const byId = new Map(variants.map((v) => [v.id, v]));
  const availableByProduct = new Map<string, AlertVariant[]>();
  for (const v of variants) {
    if (v.product.status !== "active" || !variantAvailable(v)) continue;
    const list = availableByProduct.get(v.productId) ?? [];
    list.push(v);
    availableByProduct.set(v.productId, list);
  }
  for (const list of availableByProduct.values()) list.sort((a, b) => a.position - b.position);

  const groups = new Map<string, AlertNotice & { first: string }>();
  const sorted = [...alerts].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const alert of sorted) {
    let back: AlertVariant[];
    if (alert.variantId) {
      const v = byId.get(alert.variantId);
      if (!v || v.productId !== alert.productId || v.product.status !== "active" || !variantAvailable(v)) continue;
      back = [v];
    } else {
      back = availableByProduct.get(alert.productId) ?? [];
      if (!back.length) continue;
    }
    const email = alert.email.trim().toLowerCase();
    const key = `${email}\u0000${alert.productId}`;
    const group = groups.get(key);
    if (group) {
      group.alertIds.push(alert.id);
      for (const v of back) if (!group.variants.some((g) => g.id === v.id)) group.variants.push(v);
    } else {
      groups.set(key, { email, product: back[0].product, variants: [...back], alertIds: [alert.id], first: alert.createdAt });
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.first.localeCompare(b.first))
    .slice(0, Math.max(0, limit))
    .map((g) => ({
      email: g.email,
      product: g.product,
      alertIds: g.alertIds,
      variants: [...g.variants].sort((a, b) => a.position - b.position),
    }));
}

// ---------------------------------------------------------------------------
// Envío: reclamar y mandar de a uno
// ---------------------------------------------------------------------------

export interface DeliverDeps {
  /** Marca `notified_at` sólo en los que siguen pendientes; devuelve los que reclamó ESTE proceso. */
  claim(alertIds: string[]): Promise<string[]>;
  /** Manda el mail; true si el proveedor lo aceptó. */
  send(notice: AlertNotice): Promise<boolean>;
  /** Vuelve a dejar pendientes los avisos de un mail que no salió. */
  release(alertIds: string[]): Promise<void>;
}

/**
 * Por cada mail: reclama sus avisos (update condicional), lo manda y, si no
 * salió, los libera. De a uno: si el proceso se corta a mitad de la tanda
 * (límite de `after()`), lo que no se mandó sigue pendiente en vez de quedar
 * marcado como avisado sin mail. Un error al mandar o liberar no frena el resto.
 */
export async function deliverNotices(notices: AlertNotice[], deps: DeliverDeps): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const notice of notices) {
    const claimed = await deps.claim(notice.alertIds);
    if (!claimed.length) {
      skipped++;
      continue;
    }
    const mine = { ...notice, alertIds: notice.alertIds.filter((id) => claimed.includes(id)) };
    let ok = false;
    try {
      ok = await deps.send(mine);
    } catch {
      ok = false;
    }
    if (ok) {
      sent++;
      continue;
    }
    failed++;
    await deps.release(mine.alertIds).catch(() => undefined);
  }
  return { sent, failed, skipped };
}

/** "Talle M · Negro" o null para la variante única ("Default"). */
export function variantLabel(title: string | null | undefined): string | null {
  const t = (title ?? "").trim();
  return !t || t === "Default" ? null : t;
}
