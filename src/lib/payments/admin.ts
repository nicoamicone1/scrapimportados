import "server-only";

import type { AdminContext } from "@/lib/auth";
import { parseMercadoPagoCheckout, type MercadoPagoCheckoutSettings } from "@/lib/store/settings";
import { platformUrl } from "@/lib/tenant/urls";

import { paymentsEnabled } from "./config";

export interface MercadoPagoAccountView {
  status: "connected" | "disconnected" | "error";
  mpUserId: number | null;
  liveMode: boolean;
  connectedAt: string | null;
  lastError: string | null;
}

export interface MercadoPagoAdminState {
  /** ¿Ecommy tiene configurada la app de Mercado Pago? */
  enabled: boolean;
  /** ¿La base ya tiene la migración 0023? */
  migrated: boolean;
  account: MercadoPagoAccountView | null;
  settings: MercadoPagoCheckoutSettings;
  /** Comisión de Ecommy por venta online según el plan (0 = ninguna). */
  planFeePercent: number;
  connectUrl: string;
  /** Sólo el dueño (con su sesión) conecta o desconecta. */
  isOwner: boolean;
}

/** Estado de "Tarjetas y cuotas con Mercado Pago" para Configuración › Pagos. */
export async function getMercadoPagoAdminState(ctx: AdminContext): Promise<MercadoPagoAdminState> {
  const [{ data: status, error }, { data: settingsRow }, { data: plan }] = await Promise.all([
    ctx.supabase.rpc("store_payment_account_status", { p_store_id: ctx.store.id }),
    ctx.supabase.from("store_settings").select("checkout").eq("store_id", ctx.store.id).single(),
    ctx.supabase.from("plans").select("payment_fee_percent").eq("code", ctx.plan.code).maybeSingle(),
  ]);
  const s = status && typeof status === "object" && !Array.isArray(status) ? (status as Record<string, unknown>) : null;
  const checkout = settingsRow?.checkout && typeof settingsRow.checkout === "object" && !Array.isArray(settingsRow.checkout) ? settingsRow.checkout : {};
  const st = s?.status;
  return {
    enabled: paymentsEnabled(),
    migrated: !error,
    account: s
      ? {
          status: st === "connected" || st === "error" ? st : "disconnected",
          mpUserId: typeof s.mp_user_id === "number" ? s.mp_user_id : null,
          liveMode: s.live_mode !== false,
          connectedAt: typeof s.connected_at === "string" ? s.connected_at : null,
          lastError: typeof s.last_error === "string" ? s.last_error : null,
        }
      : null,
    settings: parseMercadoPagoCheckout((checkout as Record<string, never>).mercadopago),
    planFeePercent: Number((plan as { payment_fee_percent?: number } | null)?.payment_fee_percent ?? 0) || 0,
    connectUrl: platformUrl("/api/payments/mercadopago/oauth/start"),
    isOwner: ctx.membership.role === "owner" && !ctx.membership.impersonating,
  };
}
