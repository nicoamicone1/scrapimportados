"use client";

import { ArrowLeft } from "lucide-react";
import { useActionState, useState } from "react";

import { DISPLAY, FormAlert as Alert } from "@/components/platform/brand";
import { PasswordInput } from "@/components/platform/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

import { login, requestPasswordReset, updatePassword, type AuthFormState } from "@/app/admin/actions";

function FormError({ state }: { state: AuthFormState }) {
  if (!state || state.ok) return null;
  return <Alert>{state.error}</Alert>;
}

/** Controles de 44 px y 16 px de texto en el celular (sin zoom de iOS). */
const TOUCH = "max-sm:h-11 max-sm:text-base";
const TITLE = cn(DISPLAY, "text-[28px] leading-tight font-semibold tracking-[-0.02em]");

function fieldError(state: AuthFormState, name: string) {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

export function LoginForm({ next, initialEmail }: { next: string; initialEmail?: string }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loginState, loginAction, loginPending] = useActionState(login, null);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, null);

  if (mode === "reset") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setMode("login")}
          className="mb-6 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-adm-fg-muted hover:text-adm-fg md:min-h-0"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Volver a ingresar
        </button>
        <h1 className={TITLE}>Recuperá tu contraseña</h1>
        <p className="mt-1 text-sm text-adm-fg-muted">Te mandamos un link para elegir una nueva.</p>
        {resetState?.ok ? (
          <p role="status" className="mt-6 rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2.5 text-[13px]">
            {resetState.data.message}
          </p>
        ) : (
          <form action={resetAction} className="mt-6 space-y-4">
            <FormError state={resetState} />
            <Field label="Email" error={fieldError(resetState, "email")}>
              <Input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" defaultValue={initialEmail} required autoFocus className={TOUCH} />
            </Field>
            <Button type="submit" variant="primary" size="lg" loading={resetPending} loadingText="Enviando…" className="h-11 w-full text-[15px]">
              Enviar link
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className={TITLE}>Ingresá al panel</h1>
      <p className="mt-1 text-sm text-adm-fg-muted">Con el email y la contraseña de tu cuenta.</p>
      <form action={loginAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <FormError state={loginState} />
        <Field label="Email" error={fieldError(loginState, "email")}>
          <Input name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" defaultValue={initialEmail} required autoFocus={!initialEmail} className={TOUCH} />
        </Field>
        <Field
          label="Contraseña"
          error={fieldError(loginState, "password")}
          aside={
            <button type="button" onClick={() => setMode("reset")} className="font-medium text-adm-accent underline underline-offset-2 hover:no-underline">
              ¿Olvidaste tu contraseña?
            </button>
          }
        >
          <PasswordInput name="password" autoComplete="current-password" required autoFocus={Boolean(initialEmail)} className={TOUCH} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loginPending} loadingText="Ingresando…" className="h-11 w-full text-[15px]">
          Ingresar
        </Button>
      </form>
    </div>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <div>
      <h1 className={TITLE}>Elegí una nueva contraseña</h1>
      <p className="mt-1 text-sm text-adm-fg-muted">Al guardarla entrás directo al panel.</p>
      <form action={action} className="mt-6 space-y-4">
        <FormError state={state} />
        <Field label="Nueva contraseña" hint="Al menos 8 caracteres." error={fieldError(state, "password")}>
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required autoFocus className={TOUCH} />
        </Field>
        <Field label="Repetila" error={fieldError(state, "confirm")}>
          <PasswordInput name="confirm" autoComplete="new-password" required className={TOUCH} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={pending} loadingText="Guardando…" className="h-11 w-full text-[15px]">
          Guardar y entrar
        </Button>
      </form>
    </div>
  );
}
