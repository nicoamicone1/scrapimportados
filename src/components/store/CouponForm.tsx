"use client";

import { useId, useState, useTransition } from "react";

import { applyCoupon } from "@/app/(store)/actions";
import { useCart } from "@/lib/cart";

/** Input de cupón → `validate_coupon` en el server. El cupón queda guardado en el carrito. */
export function CouponForm({ email }: { email?: string }) {
  const { items, coupon, setCoupon } = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <p>
          Cupón <span className="font-mono font-semibold">{coupon.code}</span>
          {notice ? <span className="block text-xs text-success">{notice}</span> : null}
        </p>
        <button
          type="button"
          className="link text-xs"
          onClick={() => {
            setCoupon(null);
            setNotice(null);
          }}
        >
          Quitar
        </button>
      </div>
    );
  }

  const submit = () => {
    if (!code.trim()) {
      setError("Ingresá el código del cupón.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await applyCoupon({
        code: code.trim(),
        email: email && /@/.test(email) ? email : null,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      });
      if (res.ok) {
        setCoupon(res.data.coupon);
        setNotice(res.data.message);
        setCode("");
      } else setError(res.error);
    });
  };

  return (
    <div>
      <label htmlFor={id} className="field-label">
        Cupón de descuento
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="input font-mono uppercase"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="button" className="btn btn-secondary shrink-0" onClick={submit} disabled={pending}>
          {pending ? "Validando" : "Aplicar"}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
