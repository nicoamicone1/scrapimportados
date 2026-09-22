"use client";

import { useEffect, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

/*
 * Aviso de pedidos nuevos (P0-07): cuenta los pedidos con `seen_at is null`
 * y no cancelados. Un único store por pestaña (aunque el badge se monte dos
 * veces: sidebar de escritorio y drawer mobile):
 * - polling cada 60 s + al volver a la pestaña,
 * - Supabase Realtime (INSERT en `orders`, filtrado por RLS de admin) para
 *   enterarse al instante; si el canal falla, queda el polling,
 * - prefijo "(N) " en `document.title`,
 * - notificación del navegador si el admin la habilitó (NotificationsToggle).
 */

const POLL_MS = 60_000;

interface LatestOrder {
  id: string;
  number: number;
  name: string;
  total: number;
  currency: string;
}

let count = 0;
let started = false;
let knownMaxNumber: number | null = null;
const listeners = new Set<() => void>();
let titleObserver: MutationObserver | null = null;

function emit() {
  for (const l of listeners) l();
  syncTitle();
}

function syncTitle() {
  if (typeof document === "undefined") return;
  const base = document.title.replace(/^\(\d+\)\s/, "");
  const desired = count > 0 ? `(${count}) ${base}` : base;
  if (document.title !== desired) document.title = desired;
}

function notify(latest: LatestOrder, newCount: number) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(newCount > 1 ? `${newCount} pedidos nuevos` : `Pedido nuevo #${latest.number}`, {
      body: `#${latest.number} · ${latest.name} · ${formatMoney(latest.total, { currency: latest.currency })}`,
      tag: `ecommy-order-${latest.number}`,
    });
    n.onclick = () => {
      window.focus();
      // Fuera de React no hay router: navegación completa con URL absoluta.
      window.location.assign(new URL(`/admin/pedidos/${latest.id}`, window.location.origin).href);
    };
  } catch {
    // Algunos navegadores (Android) sólo permiten notificaciones vía service worker.
  }
}

/** Relee el conteo. Se puede llamar desde afuera (ej. al abrir un pedido). */
export async function refreshNewOrdersCount(): Promise<void> {
  const supabase = createClient();
  const { data, count: c, error } = await supabase
    .from("orders")
    .select("id, number, customer, total, currency", { count: "exact" })
    .is("seen_at", null)
    .neq("status", "cancelled")
    .order("number", { ascending: false })
    .limit(1);
  if (error) return;
  const next = c ?? 0;
  const top = data?.[0];
  if (top) {
    const customer = top.customer && typeof top.customer === "object" && !Array.isArray(top.customer) ? top.customer : {};
    const latest: LatestOrder = {
      id: top.id,
      number: top.number,
      name: typeof customer.name === "string" ? customer.name : "Cliente",
      total: Number(top.total),
      currency: top.currency,
    };
    if (knownMaxNumber !== null && latest.number > knownMaxNumber) notify(latest, Math.max(1, next - count));
    knownMaxNumber = Math.max(knownMaxNumber ?? 0, latest.number);
  } else if (knownMaxNumber === null) {
    knownMaxNumber = 0;
  }
  if (next !== count) {
    count = next;
    emit();
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refreshNewOrdersCount();
  setInterval(() => {
    if (document.visibilityState === "visible") void refreshNewOrdersCount();
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshNewOrdersCount();
  });

  // Next cambia el título al navegar: se vuelve a poner el prefijo.
  titleObserver = new MutationObserver(() => syncTitle());
  titleObserver.observe(document.head, { subtree: true, childList: true, characterData: true });

  void subscribeRealtime();
}

/**
 * Realtime respeta la RLS de `orders` (is_admin()): hay que pasarle el JWT
 * del admin ANTES de suscribirse (si no, el canal queda como anónimo y no
 * llega nada). Probado: con el token, el INSERT llega en ~1 s.
 */
async function subscribeRealtime() {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await supabase.realtime.setAuth(data.session.access_token);
    supabase
      .channel("admin-new-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        void refreshNewOrdersCount();
      })
      .subscribe();
  } catch {
    // Sin realtime: alcanza con el polling.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

export function useNewOrdersCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  );
}

/** Badge del ítem "Pedidos" del sidebar. */
export function OrdersBadge({ collapsed = false }: { collapsed?: boolean }) {
  const n = useNewOrdersCount();
  if (!n) return null;
  const label = `${n} ${n === 1 ? "pedido nuevo" : "pedidos nuevos"}`;
  if (collapsed) {
    return (
      <span className="absolute top-1 right-1 size-2 rounded-full bg-adm-accent" title={label}>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn("tnum ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-adm-accent px-1 text-[11px] font-medium text-adm-accent-fg")}
      title={label}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {n === 1 ? "pedido nuevo" : "pedidos nuevos"}</span>
    </span>
  );
}

/** Refresca el badge al montar (ej. después de marcar un pedido como visto). */
export function RefreshOrdersBadge() {
  useEffect(() => {
    void refreshNewOrdersCount();
  }, []);
  return null;
}
