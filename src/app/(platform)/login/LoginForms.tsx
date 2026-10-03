"use client";

import { ArrowLeft, MailCheck } from "lucide-react";
import { useActionState, useState } from "react";

import { ACCOUNT_TITLE, SITE_INPUT, SITE_SUBMIT } from "@/components/platform/AccountShell";
import { FormAlert as Alert } from "@/components/platform/brand";
import { PasswordInput } from "@/components/platform/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

import { login, requestPasswordReset, updatePassword, type AuthFormState } from "@/app/admin/actions";

function FormError({ state }: { state: AuthFormState }) {
  if (!state || state.ok) return null;
  // Si el error es de un campo, va junto al campo; acá sólo los generales.
  if (["email", "password", "confirm"].some((k) => state.fieldErrors?.[k])) return null;
  return <Alert>{state.error}</Alert>;
}

function fieldError(state: AuthFormState, name: string) {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

export function LoginForm({ next, initialEmail }: { next: string; initialEmail?: string }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loginState, loginAction, loginPending] = useActionState(login, null);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, null);

  if (mode === "reset") {
    return (
      <div key="reset" className="eco-pop">
        <button
          type="button"
          onClick={() => setMode("login")}
          className="mb-8 inline-flex min-h-11 items-center gap-1.5 rounded-full text-[14px] font-medium text-adm-fg-muted hover:text-adm-fg"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          Volver a ingresar
        </button>
        <h1 className={ACCOUNT_TITLE}>Recuperá tu contraseña</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">Te mandamos un link para elegir una nueva.</p>
        {resetState?.ok ? (
          <div role="status" className="eco-pop mt-8 flex gap-3 rounded-[20px] rounded-bl-[4px] bg-eco-azul-soft px-4 py-4 text-[15px] leading-snug">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-adm-link" strokeWidth={1.75} aria-hidden />
            <span>{resetState.data.message}</span>
          </div>
        ) : (
          <form action={resetAction} className="mt-8 space-y-5">
            <FormError state={resetState} />
            <Field label="Email" error={fieldError(resetState, "email")}>
              <Input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" defaultValue={initialEmail} required autoFocus className={SITE_INPUT} />
            </Field>
            <Button type="submit" variant="primary" size="lg" loading={resetPending} loadingText="Enviando…" className={SITE_SUBMIT}>
              Enviar link
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div key="login" className="eco-pop">
      <h1 className={ACCOUNT_TITLE}>Hola de nuevo.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">Ingresá con el email y la contraseña de tu cuenta: entrás directo a tu última tienda.</p>
      <form action={loginAction} className="mt-8 space-y-5">
        <input type="hidden" name="next" value={next} />
        <FormError state={loginState} />
        <Field label="Email" error={fieldError(loginState, "email")}>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={initialEmail}
            required
            autoFocus={!initialEmail}
            className={SITE_INPUT}
          />
        </Field>
        <Field
          label="Contraseña"
          error={fieldError(loginState, "password")}
          aside={
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="text-[13px] font-medium text-adm-link underline decoration-1 underline-offset-[3px] hover:decoration-2"
            >
              ¿La olvidaste?
            </button>
          }
        >
          <PasswordInput name="password" autoComplete="current-password" required autoFocus={Boolean(initialEmail)} className={SITE_INPUT} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loginPending} loadingText="Ingresando…" className={SITE_SUBMIT}>
          Ingresar
        </Button>
      </form>
    </div>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <div className="eco-pop">
      <h1 className={ACCOUNT_TITLE}>Elegí una contraseña nueva</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">Al guardarla entrás directo al panel.</p>
      <form action={action} className="mt-8 space-y-5">
        <FormError state={state} />
        <Field label="Contraseña nueva" hint="Al menos 8 caracteres." error={fieldError(state, "password")}>
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required autoFocus className={SITE_INPUT} />
        </Field>
        <Field label="Repetila" error={fieldError(state, "confirm")}>
          <PasswordInput name="confirm" autoComplete="new-password" required className={SITE_INPUT} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={pending} loadingText="Guardando…" className={SITE_SUBMIT}>
          Guardar y entrar
        </Button>
      </form>
    </div>
  );
}
