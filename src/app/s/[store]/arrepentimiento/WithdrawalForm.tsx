"use client";

import { useActionState, useId } from "react";

import { submitWithdrawal, type WithdrawalState } from "../actions";

const INITIAL: WithdrawalState = { status: "idle" };

/** Formulario sin registro (Res. SCI 424/2020): nombre, contacto, n.º de pedido y motivo. */
export function WithdrawalForm({ defaultOrder }: { defaultOrder: string }) {
  const [state, action, pending] = useActionState(submitWithdrawal, INITIAL);
  const id = useId();

  if (state.status === "ok" && state.code) {
    return (
      <div className="mt-6 max-w-[560px] rounded-lg border border-border bg-surface p-5" role="status" aria-live="polite">
        <p className="text-sm text-fg-muted">Tu código de revocación</p>
        <p className="tnum mt-1 font-mono text-2xl font-semibold tracking-wide">{state.code}</p>
        <p className="mt-3 text-sm">
          Recibimos tu solicitud. Guardá este código: es el comprobante de que pediste la revocación. Te vamos a contactar dentro de las 24 horas por el
          medio que dejaste.
        </p>
        {!state.orderFound ? (
          <p className="mt-2 text-sm text-fg-muted">
            No encontramos un pedido con ese número (o no lo ingresaste); igual registramos la solicitud y la revisamos a mano.
          </p>
        ) : null}
      </div>
    );
  }

  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  const values = state.values ?? {};
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>, help?: string) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="field-label">
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        name={name}
        className="input"
        defaultValue={values[name] ?? (name === "orderNumber" ? defaultOrder : "")}
        aria-invalid={err(name) ? true : undefined}
        aria-describedby={err(name) ? `${id}-${name}-error` : help ? `${id}-${name}-help` : undefined}
        {...props}
      />
      {err(name) ? (
        <p id={`${id}-${name}-error`} className="field-error">
          {err(name)}
        </p>
      ) : help ? (
        <p id={`${id}-${name}-help`} className="field-help">
          {help}
        </p>
      ) : null}
    </div>
  );

  return (
    <form action={action} className="mt-6 grid max-w-[560px] gap-4" noValidate>
      {field("name", "Nombre y apellido", { autoComplete: "name", required: true })}
      {field("contact", "Email o teléfono de contacto", { autoComplete: "email", required: true }, "Te respondemos por este medio.")}
      {field("orderNumber", "Número de pedido", { inputMode: "numeric" }, "Lo encontrás en la página de tu pedido (ej. 1043).")}
      <div>
        <label htmlFor={`${id}-reason`} className="field-label">
          Motivo (opcional)
        </label>
        <textarea id={`${id}-reason`} name="reason" className="input" rows={3} maxLength={1000} defaultValue={values.reason ?? ""} />
      </div>
      {state.status === "error" && state.error ? (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-solid w-full sm:w-auto" disabled={pending}>
          {pending ? "Enviando" : "Enviar solicitud de arrepentimiento"}
        </button>
      </div>
    </form>
  );
}
