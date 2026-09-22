"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changeMyPassword, signOutEverywhere, updateMyName } from "@/app/admin/(panel)/usuarios/actions";
import { Button } from "@/components/ui/Button";
import { Card, FormSection } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { formatDateTime } from "@/lib/dates";

export function MyAccount({ name: initialName, email, lastSignIn }: { name: string; email: string; lastSignIn: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameError, setNameError] = useState<string>();
  const [savingName, startName] = useTransition();

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string[]>>({});
  const [savingPw, startPw] = useTransition();

  const [confirmOut, setConfirmOut] = useState(false);

  const saveName = () =>
    startName(async () => {
      const res = await updateMyName({ name });
      if (!res.ok) {
        setNameError(res.fieldErrors?.name?.[0] ?? res.error);
        return;
      }
      setNameError(undefined);
      setSavedName(name.trim());
      toast.success("Nombre actualizado.");
      router.refresh();
    });

  const savePassword = () =>
    startPw(async () => {
      const res = await changeMyPassword(pw);
      if (!res.ok) {
        setPwErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setPwErrors({});
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Contraseña cambiada.");
    });

  return (
    <Card className="max-w-5xl px-5 md:px-6">
      <div className="divide-y divide-adm-border">
        <FormSection title="Perfil" description="Tu nombre aparece en la auditoría y en el menú de usuario.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
            className="space-y-4"
          >
            <Field label="Nombre" error={nameError}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            </Field>
            <Field label="Email" hint="Para cambiarlo, pedíselo al dueño de la tienda.">
              <Input value={email} readOnly autoComplete="email" />
            </Field>
            <Button type="submit" variant="primary" loading={savingName} disabled={!name.trim() || name.trim() === savedName}>
              Guardar nombre
            </Button>
          </form>
        </FormSection>

        <FormSection title="Contraseña" description="Al menos 10 caracteres, con letras y números.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              savePassword();
            }}
            className="space-y-4"
          >
            {/* Campo oculto para que los gestores de contraseñas asocien el usuario. */}
            <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
            <Field label="Contraseña actual" error={pwErrors.current}>
              <Input
                type="password"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                autoComplete="current-password"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contraseña nueva" error={pwErrors.next}>
                <Input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" />
              </Field>
              <Field label="Repetila" error={pwErrors.confirm}>
                <Input
                  type="password"
                  value={pw.confirm}
                  onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" loading={savingPw} disabled={!pw.current || !pw.next || !pw.confirm}>
              Cambiar contraseña
            </Button>
          </form>
        </FormSection>

        <FormSection
          title="Sesiones"
          description={lastSignIn ? `Último ingreso: ${formatDateTime(lastSignIn)}.` : "Cerrá tu sesión en todos los navegadores donde entraste."}
        >
          <p className="text-sm text-adm-fg-muted">
            Si entraste desde una computadora que no es tuya o perdiste el celular, cerrá la sesión en todos lados. Vas a tener que volver a entrar acá también.
          </p>
          <Button variant="danger" icon={<LogOut />} onClick={() => setConfirmOut(true)}>
            Cerrar sesión en todos los dispositivos
          </Button>
        </FormSection>
      </div>

      <ConfirmDialog
        open={confirmOut}
        onOpenChange={setConfirmOut}
        title="¿Cerrar sesión en todos los dispositivos?"
        description="Se cierran todas tus sesiones abiertas, incluida esta."
        confirmLabel="Cerrar todas las sesiones"
        destructive
        onConfirm={async () => {
          const res = await signOutEverywhere();
          if (res && !res.ok) toast.error(res.error);
        }}
      />
    </Card>
  );
}
