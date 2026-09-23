"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { useCart } from "@/lib/cart";
import { mergeRestoredItems, RESTORE_SKIPPED_MESSAGE } from "@/lib/store/checkout-sessions";

import { restoreCheckoutSession, unsubscribeCheckoutSession } from "../checkout-sessions";

/*
 * Links del mail de carrito abandonado (migración 0020):
 *   /carrito?recuperar=<token> → repone el carrito con precios y stock de hoy;
 *   /carrito?baja=<token>      → confirma la baja de los avisos (con un botón:
 *                                los antivirus de correo abren los links solos).
 */

type Notice = { tone: "ok" | "error"; lines: string[] };

function NoticeBox({ notice }: { notice: Notice }) {
  return (
    <div
      className="mt-4 rounded-md border border-border-strong bg-bg p-3 text-sm"
      role={notice.tone === "error" ? "alert" : "status"}
    >
      <p className="font-medium">{notice.lines[0]}</p>
      {notice.lines.length > 1 ? (
        <ul className="mt-1 space-y-0.5 text-fg-muted">
          {notice.lines.slice(1).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Repone el carrito guardado (una vez por visita; abrir el link dos veces no duplica cantidades). */
export function CartRecovery({ token }: { token: string }) {
  const { items, hydrated, add, applyPatches } = useCart();
  const [notice, setNotice] = useState<Notice | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    restoreCheckoutSession(token)
      .then((res) => {
        if (!res.ok) {
          setNotice({ tone: "error", lines: [res.error] });
          return;
        }
        const { items: restored, skipped, reduced, recovered } = res.data;
        if (recovered) {
          setNotice({ tone: "ok", lines: ["Este pedido ya se confirmó. Si querés, podés armar uno nuevo."] });
          return;
        }
        const current = new Set(items.map((i) => i.variantId));
        const merged = mergeRestoredItems(items, restored);
        const patches = merged.filter((m) => current.has(m.variantId) && restored.some((r) => r.variantId === m.variantId));
        if (patches.length) {
          applyPatches(
            patches.map((p) => ({
              variantId: p.variantId,
              qty: p.qty,
              unitPrice: p.unitPrice,
              maxQty: p.maxQty ?? null,
              name: p.name,
              variantTitle: p.variantTitle,
              sku: p.sku,
              image: p.image,
              slug: p.slug,
              categoryIds: p.categoryIds,
              vatPercent: p.vatPercent,
            })),
          );
        }
        for (const r of restored) {
          if (current.has(r.variantId)) continue;
          const { qty, ...item } = r;
          add(item, qty);
        }
        // El token no queda en la barra (ni en el historial ni en un link compartido).
        try {
          window.history.replaceState(null, "", window.location.pathname);
        } catch {
          // sin History API: queda la URL tal cual (reabrirla no duplica cantidades)
        }
        const lines = [restored.length ? "Repusimos tu carrito con los precios de hoy." : "No pudimos reponer tu carrito."];
        if (skipped) lines.push(RESTORE_SKIPPED_MESSAGE);
        if (reduced) lines.push("Ajustamos algunas cantidades al stock disponible.");
        setNotice({ tone: restored.length ? "ok" : "error", lines });
      })
      .catch(() => setNotice({ tone: "error", lines: ["No pudimos reponer tu carrito. Probá de nuevo en un momento."] }));
  }, [hydrated, token, items, add, applyPatches]);

  if (!notice) {
    return hydrated ? (
      <p className="mt-4 flex items-center gap-2 text-sm text-fg-muted" role="status">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden />
        Reponiendo tu carrito…
      </p>
    ) : null;
  }
  return <NoticeBox notice={notice} />;
}

/** Baja de los avisos de carrito de esta tienda. */
export function CartUnsubscribe({ token, storeName }: { token: string; storeName: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <NoticeBox
        notice={{
          tone: "ok",
          lines: [`Listo: ${storeName} no te va a volver a escribir por pedidos sin terminar.`, "Los mails de tus compras te siguen llegando."],
        }}
      />
    );
  }

  return (
    <div className="mt-4 rounded-md border border-border-strong bg-bg p-4 text-sm">
      <p className="font-medium">¿Dejar de recibir avisos de pedidos sin terminar?</p>
      <p className="mt-1 text-fg-muted">
        Vale para este email en {storeName}. Borramos también el carrito que habías dejado guardado.
      </p>
      {error ? (
        <p className="mt-2 text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary mt-3"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await unsubscribeCheckoutSession(token);
            if (res.ok) setDone(true);
            else setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden /> : null}
        Darme de baja
      </button>
    </div>
  );
}
