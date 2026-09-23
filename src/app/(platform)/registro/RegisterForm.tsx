"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { resendConfirmation, signUp, type AuthFormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";

function fieldError(state: AuthFormState, name: string) {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

function CheckEmail({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmation, null);
  return (
    <div>
      <MailCheck className="size-6 text-adm-accent" strokeWidth={1.5} aria-hidden />
      <h1 className="mt-3 text-[22px] leading-7 font-semibold tracking-[-0.01em]">Revisá tu correo</h1>
      <p className="mt-2 text-sm text-adm-fg-muted">
        Te mandamos un link a <span className="font-medium text-adm-fg">{email}</span> para confirmar la cuenta. Al abrirlo seguís con la creación
        de tu tienda.
      </p>
      <form action={action} className="mt-6 flex flex-wrap items-center gap-3">
        <input type="hidden" name="email" value={email} />
        <Button type="submit" loading={pending} loadingText="Reenviando…">
          Reenviar el email
        </Button>
        {state?.ok ? <span className="text-[13px] text-adm-fg-muted">{state.data.message}</span> : null}
      </form>
      <p className="mt-6 text-[13px] text-adm-fg-muted">¿No llega? Mirá en spam o promociones.</p>
    </div>
  );
}

export function RegisterForm({ next, initialEmail }: { next?: string; initialEmail?: string }) {
  const [state, action, pending] = useActionState(signUp, null);

  if (state?.ok && state.data.message === "confirm" && state.data.email) return <CheckEmail email={state.data.email} />;

  return (
    <div>
      <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">Creá tu cuenta</h1>
      <p className="mt-1 text-sm text-adm-fg-muted">Después armás tu tienda en tres pasos. 14 días de Pro gratis, sin tarjeta.</p>
      <form action={action} className="mt-6 space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {state && !state.ok ? (
          <p role="alert" className="rounded-adm border border-[#efc6c0] bg-adm-danger-soft px-3 py-2 text-[13px] text-[#8f1c13]">
            {state.error}
          </p>
        ) : null}
        <Field label="Tu nombre" error={fieldError(state, "name")}>
          <Input name="name" autoComplete="name" required autoFocus maxLength={80} />
        </Field>
        <Field label="Email" error={fieldError(state, "email")}>
          <Input name="email" type="email" autoComplete="email" defaultValue={initialEmail} readOnly={Boolean(initialEmail)} required />
        </Field>
        <Field label="Contraseña" hint="Al menos 8 caracteres." error={fieldError(state, "password")}>
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <div>
          <label className="flex items-start gap-2 text-[13px]">
            <Checkbox name="terms" required className="mt-0.5" />
            <span>
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="text-adm-accent hover:underline">
                términos del servicio
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" target="_blank" className="text-adm-accent hover:underline">
                política de privacidad
              </Link>
              .
            </span>
          </label>
          {fieldError(state, "terms") ? <p className="mt-1 text-xs text-adm-danger">{fieldError(state, "terms")?.[0]}</p> : null}
        </div>
        <Button type="submit" variant="primary" size="lg" loading={pending} loadingText="Creando cuenta…" className="w-full">
          Crear cuenta
        </Button>
      </form>
    </div>
  );
}
