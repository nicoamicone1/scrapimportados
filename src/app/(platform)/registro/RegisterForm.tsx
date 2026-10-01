"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { resendConfirmation, signUp, type AuthFormState } from "@/app/admin/actions";
import { FlowProgress } from "@/components/platform/AccountShell";
import { DISPLAY, FormAlert } from "@/components/platform/brand";
import { PasswordInput } from "@/components/platform/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

/** Controles de 44 px y 16 px de texto en el celular (sin zoom de iOS, BRAND §7). */
const TOUCH = "max-sm:h-11 max-sm:text-base";

function fieldError(state: AuthFormState, name: string) {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

function CheckEmail({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmation, null);
  return (
    <div>
      <MailCheck className="size-6 text-adm-accent" strokeWidth={1.5} aria-hidden />
      <h1 className={cn(DISPLAY, "mt-3 text-[26px] leading-tight font-semibold tracking-[-0.02em]")}>Revisá tu correo</h1>
      <p className="mt-2 text-sm leading-relaxed text-adm-fg-muted">
        Te mandamos un link a <span className="font-medium text-adm-fg">{email}</span>. Al abrirlo seguís con tu tienda: nombre, rubro y cómo
        cobrás.
      </p>
      <p className="mt-3 text-[13px] text-adm-fg-muted">¿No llega en un par de minutos? Mirá en spam o en promociones.</p>
      <form action={action} className="mt-6 flex flex-wrap items-center gap-3">
        <input type="hidden" name="email" value={email} />
        <Button type="submit" size="lg" loading={pending} loadingText="Reenviando…">
          Reenviar el email
        </Button>
        {state?.ok ? (
          <span role="status" className="text-[13px] text-adm-fg-muted">
            {state.data.message}
          </span>
        ) : null}
      </form>
    </div>
  );
}

/**
 * Registro (paso 1 de 3 cuando sigue el alta de tienda). Tres campos y un
 * botón: los términos se aceptan al crear la cuenta (aviso junto al botón,
 * el server sigue recibiendo `terms=on`), la contraseña se puede ver en vez
 * de repetirse y el email de una invitación llega precargado.
 */
export function RegisterForm({ next, initialEmail, createsStore = true }: { next?: string; initialEmail?: string; createsStore?: boolean }) {
  const [state, action, pending] = useActionState(signUp, null);

  if (state?.ok && state.data.message === "confirm" && state.data.email) return <CheckEmail email={state.data.email} />;

  return (
    <div>
      {createsStore ? <FlowProgress step={1} total={3} label="Tu cuenta" /> : null}
      <h1 className={cn(DISPLAY, "text-[28px] leading-tight font-semibold tracking-[-0.02em]")}>
        {createsStore ? "Creá tu tienda gratis" : "Creá tu cuenta"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-adm-fg-muted">
        {createsStore
          ? "Primero tu cuenta; después, el nombre y el rubro de la tienda. 14 días de Pro, sin tarjeta."
          : "Con esta cuenta entrás al panel de la tienda que te invitó."}
      </p>
      <form action={action} className="mt-6 space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input type="hidden" name="terms" value="on" />
        {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}
        <Field label="Tu nombre" error={fieldError(state, "name")}>
          <Input name="name" autoComplete="name" required autoFocus={!initialEmail} maxLength={80} className={TOUCH} />
        </Field>
        <Field label="Email" error={fieldError(state, "email")}>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={initialEmail}
            readOnly={Boolean(initialEmail)}
            required
            className={TOUCH}
          />
        </Field>
        <Field label="Contraseña" hint="Al menos 8 caracteres." error={fieldError(state, "password")}>
          <PasswordInput name="password" autoComplete="new-password" minLength={8} maxLength={72} required className={TOUCH} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={pending} loadingText="Creando cuenta…" className="h-11 w-full text-[15px]">
          {createsStore ? "Crear cuenta y seguir" : "Crear cuenta"}
        </Button>
        <p className="text-[12px] leading-relaxed text-adm-fg-muted">
          Al crear la cuenta aceptás los{" "}
          <Link href="/terminos" target="_blank" className="underline underline-offset-2 hover:text-adm-fg">
            términos del servicio
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" target="_blank" className="underline underline-offset-2 hover:text-adm-fg">
            política de privacidad
          </Link>
          .
        </p>
        {fieldError(state, "terms") ? <FormAlert>{fieldError(state, "terms")?.[0]}</FormAlert> : null}
      </form>
    </div>
  );
}
