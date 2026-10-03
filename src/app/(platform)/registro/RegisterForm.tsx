"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { resendConfirmation, signUp, type AuthFormState } from "@/app/admin/actions";
import { ACCOUNT_TITLE, FlowProgress, SITE_INPUT, SITE_SUBMIT } from "@/components/platform/AccountShell";
import { FormAlert, TEXT_LINK } from "@/components/platform/brand";
import { PasswordInput } from "@/components/platform/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

const STEPS = ["Tu cuenta", "Tu tienda", "Cobros"] as const;

function fieldError(state: AuthFormState, name: string) {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

function CheckEmail({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmation, null);
  return (
    <div className="eco-pop">
      <span className="flex size-14 items-center justify-center rounded-[20px] rounded-bl-[5px] bg-eco-durazno text-eco-ink">
        <MailCheck className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className={`${ACCOUNT_TITLE} mt-6`}>Revisá tu correo</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
        Te mandamos un link a <span className="font-medium text-adm-fg">{email}</span>. Al abrirlo seguís con tu tienda: nombre, rubro y cómo
        cobrás.
      </p>
      <p className="mt-3 text-[14px] text-adm-fg-muted">¿No llega en un par de minutos? Mirá en spam o en promociones.</p>
      <form action={action} className="mt-6 flex flex-wrap items-center gap-3">
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="secondary" size="lg" loading={pending} loadingText="Reenviando…" className="h-12 rounded-full px-6 text-[15px]">
          Reenviar el email
        </Button>
        {state?.ok ? (
          <span role="status" className="text-[14px] text-adm-fg-muted">
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
    <div className="eco-pop">
      {createsStore ? <FlowProgress step={1} total={3} label="Tu cuenta" steps={STEPS} /> : null}
      <h1 className={ACCOUNT_TITLE}>
        {createsStore ? "Tu tienda empieza acá" : "Creá tu cuenta"}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
        {createsStore
          ? "Tres datos y seguís con el nombre y el estilo de tu tienda. 14 días de Pro, sin tarjeta."
          : "Con esta cuenta entrás al panel de la tienda que te invitó."}
      </p>
      <form action={action} className="mt-8 space-y-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input type="hidden" name="terms" value="on" />
        {state && !state.ok && !["name", "email", "password", "terms"].some((k) => state.fieldErrors?.[k]) ? <FormAlert>{state.error}</FormAlert> : null}
        <Field label="Tu nombre" error={fieldError(state, "name")}>
          <Input name="name" autoComplete="name" required autoFocus={!initialEmail} maxLength={80} className={SITE_INPUT} />
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
            className={SITE_INPUT}
          />
        </Field>
        <Field label="Contraseña" hint="Al menos 8 caracteres." error={fieldError(state, "password")}>
          <PasswordInput name="password" autoComplete="new-password" minLength={8} maxLength={72} required className={SITE_INPUT} />
        </Field>
        <Button
          type="submit"
          variant={createsStore ? "accent" : "primary"}
          size="lg"
          loading={pending}
          loadingText="Creando cuenta…"
          iconRight={createsStore ? <ArrowRight /> : undefined}
          className={SITE_SUBMIT}
        >
          {createsStore ? "Crear cuenta y seguir" : "Crear cuenta"}
        </Button>
        <p className="text-center text-[13px] leading-relaxed text-adm-fg-muted">
          Al crear la cuenta aceptás los{" "}
          <Link href="/terminos" target="_blank" className={TEXT_LINK}>
            términos del servicio
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" target="_blank" className={TEXT_LINK}>
            política de privacidad
          </Link>
          .
        </p>
        {fieldError(state, "terms") ? <FormAlert>{fieldError(state, "terms")?.[0]}</FormAlert> : null}
      </form>
    </div>
  );
}
