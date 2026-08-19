"use client";

import Link from "next/link";
import { useState } from "react";

import { PAYMENT_LABEL, useCart, type PaymentMethod } from "../lib/cart";
import { formatPrice } from "../lib/format";
import { buildWhatsAppUrl } from "../lib/whatsapp";
import ProductImage from "./ProductImage";

const PAYMENTS: PaymentMethod[] = ["efectivo", "web"];

const FIELD =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

/**
 * Contenido del carrito. Se usa tal cual en el drawer y en `/carrito`.
 * Todo pasa por el contexto, así que ambas vistas comparten estado.
 */
export default function CartView({
  variant = "drawer",
  onNavigate,
}: {
  /** "drawer" scrollea la lista; "page" fluye con la página. */
  variant?: "drawer" | "page";
  onNavigate?: () => void;
}) {
  const {
    items,
    hydrated,
    count,
    total,
    payment,
    setPayment,
    setQty,
    remove,
    clear,
    unitPrice,
  } = useCart();

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  if (!hydrated) {
    return <p className="p-4 text-sm text-muted">Cargando carrito…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
          >
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="17" cy="20" r="1.4" />
            <path d="M2.5 3h2.2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.2a1.6 1.6 0 0 0 1.6-1.2L21 7H6" />
          </svg>
        </span>
        <p className="text-sm text-muted">Tu carrito está vacío.</p>
        <Link
          href="/productos/"
          onClick={onNavigate}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          Ver productos
        </Link>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppUrl({
    items,
    payment,
    total,
    unitPrice,
    name,
    notes,
  });

  return (
    <div
      className={
        variant === "drawer"
          ? "flex h-full flex-col bg-white"
          : "flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
      }
    >
      {/* Items */}
      <ul
        className={[
          "divide-y divide-line",
          variant === "drawer" ? "min-h-0 flex-1 overflow-y-auto" : "",
        ].join(" ")}
      >
        {items.map((item) => {
          const unit = unitPrice(item);
          return (
            <li key={item.id} className="flex gap-3 p-3">
              <Link
                href={`/producto/${item.slug}/`}
                onClick={onNavigate}
                className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-tint p-1"
              >
                <ProductImage src={item.image} alt={item.name} />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/producto/${item.slug}/`}
                    onClick={onNavigate}
                    className="line-clamp-2 text-xs font-semibold leading-snug text-ink transition hover:text-brand-700"
                  >
                    {item.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label={`Quitar ${item.name}`}
                    className="shrink-0 rounded-lg p-1 text-muted transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                <span className="font-mono text-[10px] text-muted">
                  SKU {item.sku}
                </span>

                <div className="mt-auto flex items-end justify-between gap-2">
                  <div className="inline-flex items-center rounded-xl border border-line bg-white">
                    <button
                      type="button"
                      onClick={() => setQty(item.id, item.qty - 1)}
                      aria-label="Restar uno"
                      className="rounded-l-xl px-2.5 py-1 text-sm text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      −
                    </button>
                    <span className="min-w-8 px-1 text-center text-sm font-bold tabular-nums text-ink">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(item.id, item.qty + 1)}
                      aria-label="Sumar uno"
                      className="rounded-r-xl px-2.5 py-1 text-sm text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      +
                    </button>
                  </div>

                  {/* Mismo patrón de precio que las tarjetas: nunca corta. */}
                  <div className="flex flex-col items-end text-right">
                    <span className="whitespace-nowrap text-[10px] tabular-nums text-muted">
                      {formatPrice(unit)} c/u
                    </span>
                    <span className="whitespace-nowrap text-base font-extrabold leading-tight tabular-nums text-accent-700">
                      {formatPrice(unit * item.qty)}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Resumen */}
      <div className="flex flex-col gap-3 border-t border-line bg-white p-3.5">
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
            Forma de pago
          </span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
            {PAYMENTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPayment(p)}
                aria-pressed={payment === p}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  payment === p
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-muted hover:text-ink",
                ].join(" ")}
              >
                {PAYMENT_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2 border-t border-line pt-3">
          <span className="text-sm text-muted">
            Total ({count} {count === 1 ? "ítem" : "ítems"})
          </span>
          <span className="whitespace-nowrap text-2xl font-extrabold tabular-nums text-accent-700">
            {formatPrice(total)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre (opcional)"
            className={FIELD}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas del pedido (opcional)"
            className={`${FIELD} resize-none`}
          />
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 0 1 12 4zm-3.4 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.2.2 1.8 2.9 4.5 4 2.2.9 2.7.7 3.2.7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.2.1-1.3l-.6-.3s-1.4-.7-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.7-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.5l-.8-1.9c-.2-.5-.4-.5-.6-.5z" />
          </svg>
          Finalizar compra por WhatsApp
        </a>

        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold text-muted underline underline-offset-4 transition hover:text-rose-600"
        >
          Vaciar carrito
        </button>
      </div>
    </div>
  );
}
