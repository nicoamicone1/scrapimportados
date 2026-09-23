"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import { subscribeStockAlert } from "@/app/s/[store]/stock-alerts";

/**
 * "¿Querés que te avisemos cuando vuelva?" bajo el botón "Sin stock" de la
 * ficha (DESIGN.md §6.3). Sin card ni sombra: una línea, el input del tema y
 * un botón secundario. `variantId` null = aviso por el producto entero
 * (agotado y todavía sin opción elegida). El padre lo monta con `key` por
 * variante, así el estado vuelve a cero al cambiar de talle o color.
 */
export function StockAlertForm({ productId, variantId }: { productId: string; variantId: string | null }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; duplicate: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="text-sm text-fg-muted" role="status">
        {done.duplicate ? (
          <>Ya estabas anotado: te avisamos a {done.email} cuando vuelva.</>
        ) : (
          <>Listo, te avisamos a {done.email}.</>
        )}
      </p>
    );
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setError("Revisá el email.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await subscribeStockAlert({ productId, variantId, email: value });
      if (res.ok) setDone(res.data);
      else setError(res.error);
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={id} className="block text-sm text-fg-muted">
        ¿Querés que te avisemos cuando vuelva?
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          maxLength={254}
          required
        />
        <button type="submit" className="btn btn-secondary shrink-0" disabled={pending}>
          {pending ? "Anotando" : "Avisarme"}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
