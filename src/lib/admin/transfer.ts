/**
 * Pasar la tienda a otra persona (migración 0024, RPC `transfer_store`).
 * Pura: sirve en server y client.
 *
 * Una tienda puede tener varios dueños, pero una sola persona la tiene a su
 * nombre (`stores.owner_id`, el titular): es quien cuenta para el máximo de
 * 3 tiendas por cuenta y quien recibe los mails de cuenta. Pasar la tienda
 * cambia el titular; el anterior queda como administrador o sale del equipo.
 *
 * Las reglas de la prueba y del débito automático son espejo de
 * `private.apply_store_transfer` y `private.assert_store_transferable`: la
 * base decide, esto sólo anticipa en el diálogo lo que va a pasar.
 */

export const TRANSFER_TRIAL_DAYS = 14;
export const TRANSFER_LINK_DAYS = 7;
export const MAX_OWNED_STORES = 3;

export interface TransferSubscription {
  plan_code: string;
  status: string;
  trial_ends_at: string | null;
  provider: string | null;
  provider_ref: string | null;
  provider_status: string | null;
  last_payment_at: string | null;
}

/** ¿El plan se cobra con un débito automático de Mercado Pago (a nombre de quien lo paga)? Bloquea el traspaso. */
export function debitBlocksTransfer(sub: TransferSubscription | null | undefined): boolean {
  return Boolean(
    sub?.provider === "mercadopago" &&
      sub.provider_ref &&
      (sub.provider_status === "authorized" || sub.provider_status === "authorized_unpaid" || sub.provider_status === "paused"),
  );
}

/**
 * Fin de la prueba de Pro que arranca al pasar la tienda, o `null` si no
 * arranca ninguna. Sólo el primer cambio de titular de la tienda y sólo si
 * nunca se pagó un plan (en prueba o en Free). Nunca acorta una prueba vigente.
 */
export function trialAfterTransfer(
  sub: TransferSubscription | null | undefined,
  opts: { alreadyTransferred: boolean; now?: Date },
): string | null {
  if (!sub || opts.alreadyTransferred) return null;
  if (sub.last_payment_at || (sub.provider ?? "manual") === "mercadopago") return null;
  if (sub.status !== "trialing" && sub.plan_code !== "free") return null;
  const now = opts.now ?? new Date();
  const fresh = now.getTime() + TRANSFER_TRIAL_DAYS * 86_400_000;
  const current = sub.status === "trialing" && sub.trial_ends_at ? Date.parse(sub.trial_ends_at) : NaN;
  return new Date(Number.isFinite(current) && current > fresh ? current : fresh).toISOString();
}

export type TransferResult =
  | { status: "transferred"; id: string; userId: string; trialEndsAt: string | null }
  | { status: "pending"; id: string; token: string; expiresAt: string; hasAccount: boolean };

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/** Lee el jsonb que devuelve `transfer_store`. `null` si no tiene la forma esperada. */
export function parseTransferResult(data: unknown): TransferResult | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const id = str(d.id);
  if (!id) return null;
  if (d.status === "transferred") {
    const userId = str(d.user_id);
    return userId ? { status: "transferred", id, userId, trialEndsAt: str(d.trial_ends_at) } : null;
  }
  if (d.status === "pending") {
    const token = str(d.token);
    const expiresAt = str(d.expires_at);
    return token && expiresAt ? { status: "pending", id, token, expiresAt, hasAccount: d.has_account === true } : null;
  }
  return null;
}

/** Mensajes de la base → texto para el panel (`null` si no es uno conocido). */
export function transferError(message: string): string | null {
  if (/débito automático/i.test(message)) {
    return "El plan se paga con débito automático de Mercado Pago a tu nombre. Cancelá la renovación en Plan y después pasá la tienda.";
  }
  if (/3 tiendas/i.test(message)) {
    return `Esa cuenta ya tiene ${MAX_OWNED_STORES} tiendas a su nombre, el máximo por cuenta. Para recibir esta tiene que pasar o borrar una de las suyas.`;
  }
  if (/ya tiene la tienda a su nombre/i.test(message)) return "Esa persona ya tiene la tienda a su nombre.";
  if (/sólo quien tiene la tienda/i.test(message)) return "Sólo quien tiene la tienda a su nombre puede pasarla.";
  if (/email válido/i.test(message)) return "Ingresá un email válido.";
  if (/cambió de dueño/i.test(message)) return "La tienda cambió de dueño después de este link. Pedí uno nuevo.";
  if (/venció/i.test(message)) return "El link venció. Pedí uno nuevo.";
  if (/ya se usó/i.test(message)) return "Este link ya se usó.";
  if (/no existe o lo anularon/i.test(message)) return "El link no existe o lo anularon. Pedí uno nuevo.";
  if (/el link es para/i.test(message)) return message.replace(/^.*?(El link es para .+?)\.?$/i, "$1.");
  if (/a su nombre\. para cambiarle el rol/i.test(message)) {
    return "Esa persona tiene la tienda a su nombre. Para cambiarle el rol o sacarla del equipo, primero tiene que pasar la tienda.";
  }
  return null;
}

export interface TransferPreviewInput {
  storeName: string;
  email: string;
  /** El email es de alguien del equipo: pasa ya, sin link. */
  isMember: boolean;
  keepPrevious: boolean;
  /** Quien confirma es el titular (si no, es el superadmin operando la tienda). */
  actorIsTitular: boolean;
  titularEmail: string | null;
  /** Fin de la prueba que arrancaría (ver `trialAfterTransfer`). */
  trialEndsAt: string | null;
  mpSalesConnected: boolean;
  /** Resto del equipo que sigue con acceso: "ana@x.com (Dueño)". */
  others: string[];
}

export interface TransferPreview {
  confirmLabel: string;
  consequences: string[];
}

/**
 * Qué pasa al confirmar, en el orden en que importa (BRAND §3.2: verbo
 * exacto y consecuencia). Las fechas las formatea quien llama.
 */
export function transferPreview(d: TransferPreviewInput, formatDate: (iso: string) => string): TransferPreview {
  const who = d.email.trim() || "esa persona";
  const out: string[] = [];
  if (d.isMember) {
    out.push(`${who} queda con ${d.storeName} a su nombre y control total, incluido el equipo. Pasa ya, sin link.`);
  } else {
    out.push(
      `Le armamos a ${who} un link para recibir ${d.storeName} (vence en ${TRANSFER_LINK_DAYS} días). Hasta que lo acepte, la tienda sigue a ${d.actorIsTitular ? "tu" : "su"} nombre y podés anularlo.`,
    );
  }
  if (d.titularEmail || d.actorIsTitular) {
    const prev = d.actorIsTitular ? "Vos" : d.titularEmail;
    const verb = d.actorIsTitular ? (d.keepPrevious ? "seguís" : "salís") : d.keepPrevious ? "sigue" : "sale";
    out.push(
      d.keepPrevious
        ? `${prev} ${verb} en el equipo como administrador: todo menos invitar gente, cambiar roles y pasar la tienda.`
        : `${prev} ${verb} del equipo y ${d.actorIsTitular ? "dejás" : "deja"} de ver la tienda en el panel.`,
    );
  }
  if (d.trialEndsAt) {
    out.push(
      d.isMember
        ? `Arranca una prueba de Pro gratis hasta el ${formatDate(d.trialEndsAt)} (sólo con el primer cambio de dueño de la tienda).`
        : `Cuando la reciba arrancan ${TRANSFER_TRIAL_DAYS} días de prueba de Pro gratis (sólo con el primer cambio de dueño de la tienda).`,
    );
  }
  if (d.mpSalesConnected) {
    out.push("Se desconecta el cobro con tarjeta de Mercado Pago: la plata de los pedidos tiene que ir a la cuenta del nuevo dueño, que la conecta en Pagos.");
  }
  out.push("Los datos para transferir (CBU o alias), el WhatsApp y el email de contacto de la tienda no cambian: que los revise al recibirla.");
  if (d.others.length) out.push(`Siguen en el equipo: ${d.others.join(", ")}.`);
  out.push(`Para volver atrás, ${who} ${d.actorIsTitular ? "te " : ""}la tiene que pasar de nuevo.`);
  return { confirmLabel: d.isMember ? "Pasar la tienda" : "Crear link para pasar la tienda", consequences: out };
}
