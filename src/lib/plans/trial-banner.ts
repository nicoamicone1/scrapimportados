import { DEFAULT_TIMEZONE } from "@/lib/dates";

import { PLAN_DEFAULTS, PLAN_NAMES, trialDaysLeft, type PlanCode, type PlanLimits, type SubscriptionStatus } from "./index";

/**
 * Franja de prueba/plan del panel (`TrialBanner`, montada en el layout).
 * Puro: el layout le pasa el plan efectivo (`ctx.plan`, RPC `current_plan`)
 * y `now`; los días salen de `trialDaysLeft` (lo mismo que usa `getPlanChip`).
 *
 * - En prueba, más de 3 días: tono neutro ("Te quedan 9 días de Pro gratis").
 * - En prueba, 3 o 2 días: ámbar.
 * - Últimas 24 h: ámbar fuerte, "Tu prueba de Pro termina hoy a las 18:30"
 *   (o "mañana a las …" si el corte cae pasada la medianoche).
 * - Free: franja discreta que se puede cerrar por 7 días. Si la prueba acaba
 *   de vencer (la suscripción sigue en `trialing` hasta que corre
 *   `expire_trials()`), lo dice.
 * - Starter/Pro/Business activos o con pago pendiente: nada (el chip del
 *   sidebar ya avisa el pago pendiente).
 */

export type TrialBannerTone = "neutral" | "warning" | "urgent";

export type TrialBannerState =
  | { kind: "none" }
  | {
      kind: "trial";
      tone: TrialBannerTone;
      planName: string;
      daysLeft: number;
      /** Sólo en las últimas 24 h: el corte cae hoy (zona de la tienda) o mañana. */
      endsOn: "today" | "tomorrow" | null;
      /** "18:30" en la zona de la tienda (sólo en las últimas 24 h). */
      endsAtTime: string | null;
      /** "2 de octubre" en la zona de la tienda. */
      endsAtDate: string;
      message: string;
    }
  | { kind: "free"; afterTrial: boolean; message: string };

export interface TrialBannerInput {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  planCode: PlanCode;
  planName?: string;
  /** Límites efectivos del plan (default: los de Free). */
  limits?: Pick<PlanLimits, "products" | "pages">;
  /** La prueba venció y todavía no corrió `expire_trials()` (dato de `subscriptions`). */
  trialExpired?: boolean;
  now?: Date;
  timeZone?: string;
}

/** Cookie que oculta la franja de Free (7 días). */
export const FREE_BANNER_COOKIE = "adm-free-banner";
export const FREE_BANNER_DISMISS_DAYS = 7;

const DAY_MS = 86_400_000;

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function fmt(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone }).format(date);
}

/** "hasta 50 productos y sólo la página de inicio" (`pages: 1`: la home y nada más). */
export function freeLimitsText(limits: Pick<PlanLimits, "products" | "pages"> = PLAN_DEFAULTS.free.limits): string {
  const parts: string[] = [];
  if (limits.products !== null) parts.push(`hasta ${limits.products.toLocaleString("es-AR")} productos`);
  if (limits.pages === 1) parts.push("sólo la página de inicio");
  else if (limits.pages !== null) parts.push(`${limits.pages} páginas en el editor`);
  return parts.join(" y ");
}

export function trialBannerState(input: TrialBannerInput): TrialBannerState {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone || DEFAULT_TIMEZONE;

  if (input.status === "trialing" && input.trialEndsAt) {
    const end = new Date(input.trialEndsAt);
    const ms = end.getTime() - now.getTime();
    if (Number.isNaN(ms)) return { kind: "none" };
    if (ms > 0) {
      const planName = input.planName || PLAN_NAMES[input.planCode];
      const daysLeft = trialDaysLeft({ status: "trialing", trialEndsAt: input.trialEndsAt }, now);
      const endsAtDate = fmt(end, timeZone, { day: "numeric", month: "long" });
      if (ms <= DAY_MS) {
        const endsOn = dayKey(end, timeZone) === dayKey(now, timeZone) ? "today" : "tomorrow";
        const endsAtTime = fmt(end, timeZone, { hour: "2-digit", minute: "2-digit", hour12: false });
        return {
          kind: "trial",
          tone: "urgent",
          planName,
          daysLeft,
          endsOn,
          endsAtTime,
          endsAtDate,
          message: `Tu prueba de ${planName} termina ${endsOn === "today" ? "hoy" : "mañana"} a las ${endsAtTime}.`,
        };
      }
      return {
        kind: "trial",
        tone: daysLeft <= 3 ? "warning" : "neutral",
        planName,
        daysLeft,
        endsOn: null,
        endsAtTime: null,
        endsAtDate,
        message: `Te quedan ${daysLeft} días de ${planName} gratis (hasta el ${endsAtDate}).`,
      };
    }
    // Vencida pero todavía sin barrer: `current_plan` ya la cuenta como Free.
    return freeState(input, true);
  }

  if (input.planCode === "free") return freeState(input, Boolean(input.trialExpired));
  return { kind: "none" };
}

function freeState(input: TrialBannerInput, afterTrial: boolean): TrialBannerState {
  const limits = freeLimitsText(input.planCode === "free" && input.limits ? input.limits : PLAN_DEFAULTS.free.limits);
  const lead = afterTrial ? "Terminó tu prueba y la tienda pasó a Free" : "Estás en Free";
  return { kind: "free", afterTrial, message: `${lead}: ${limits}.` };
}
