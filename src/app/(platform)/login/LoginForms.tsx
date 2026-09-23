"use client";

import { ArrowLeft } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

import { login, requestPasswordReset, updatePassword, type AuthFormState } from "@/app/admin/actions";

function FormError({ state }: { state: AuthFormState }) {
  if (!state || state.ok) return null;
  return (
    <p role="alert" className="rounded-adm border border-[#efc6c0] bg-adm-danger-soft px-3 py-2 text-[13px] text-[#8f1c13]">
      {state.error}
    </p>
  );
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
      <div>
        <button
          type="button"
          onClick={() => setMode("login")}
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-adm-fg-muted hover:text-adm-fg"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Volver a ingresar
        </button>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">Recuperá tu contraseña</h1>
        <p className="mt-1 text-sm text-adm-fg-muted">Te mandamos un link para elegir una nueva.</p>
        {resetState?.ok ? (
          <p role="status" className="mt-6 rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2.5 text-[13px]">
            {resetState.data.message}
          </p>
        ) : (
          <form action={resetAction} className="mt-6 space-y-4">
            <FormError state={resetState} />
            <Field label="Email" error={fieldError(resetState, "email")}>
              <Input name="email" type="email" autoComplete="email" defaultValue={initialEmail} required autoFocus />
            </Field>
            <Button type="submit" variant="primary" size="lg" loading={resetPending} loadingText="Enviando…" className="w-full">
              Enviar link
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">Ingresá al panel</h1>
      <p className="mt-1 text-sm text-adm-fg-muted">Con el email y la contraseña de tu cuenta.</p>
      <form action={loginAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <FormError state={loginState} />
        <Field label="Email" error={fieldError(loginState, "email")}>
          <Input name="email" type="email" autoComplete="username" defaultValue={initialEmail} required autoFocus />
        </Field>
        <Field
          label="Contraseña"
          error={fieldError(loginState, "password")}
          aside={
            <button type="button" onClick={() => setMode("reset")} className="text-adm-accent hover:underline">
              ¿Olvidaste tu contraseña?
            </button>
          }
        >
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loginPending} loadingText="Ingresando…" className="w-full">
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
      <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">Elegí una nueva contraseña</h1>
      <p className="mt-1 text-sm text-adm-fg-muted">Al guardarla entrás directo al panel.</p>
      <form action={action} className="mt-6 space-y-4">
        <FormError state={state} />
        <Field label="Nueva contraseña" hint="Al menos 8 caracteres." error={fieldError(state, "password")}>
          <Input name="password" type="password" autoComplete="new-password" required autoFocus />
        </Field>
        <Field label="Repetila" error={fieldError(state, "confirm")}>
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={pending} loadingText="Guardando…" className="w-full">
          Guardar y entrar
        </Button>
      </form>
    </div>
  );
}
