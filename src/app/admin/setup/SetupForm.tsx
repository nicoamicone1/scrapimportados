"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

import { setupOwner } from "../actions";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupOwner, null);
  const err = (name: string) => (state && !state.ok ? state.fieldErrors?.[name] : undefined);

  if (state?.ok) {
    return (
      <p role="status" className="rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2.5 text-[13px]">
        {state.data.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? (
        <p role="alert" className="rounded-adm border border-[#efc6c0] bg-adm-danger-soft px-3 py-2 text-[13px] text-[#8f1c13]">
          {state.error}
        </p>
      ) : null}
      <Field label="Tu nombre" error={err("name")}>
        <Input name="name" autoComplete="name" required autoFocus />
      </Field>
      <Field label="Email" error={err("email")}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" hint="Al menos 8 caracteres." error={err("password")}>
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Crear cuenta de dueño
      </Button>
    </form>
  );
}
