import { signOut } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";

/** Pantalla para cuentas `pending` (o desactivadas): sin acceso al panel. */
export function PendingApproval({ email, inactive }: { email: string; inactive?: boolean }) {
  return (
    <div className="flex min-h-dvh items-start px-6 py-16 sm:px-12 sm:py-24">
      <div className="w-full max-w-[440px]">
        <p className="text-xs font-medium tracking-[0.06em] text-adm-fg-muted uppercase">
          {inactive ? "Cuenta desactivada" : "Cuenta pendiente"}
        </p>
        <h1 className="mt-2 text-xl font-semibold">
          {inactive ? "Tu acceso al panel está pausado" : "Tu cuenta espera aprobación"}
        </h1>
        <p className="mt-2 text-sm text-adm-fg-muted">
          {inactive
            ? "El dueño de la tienda desactivó esta cuenta. Si creés que es un error, hablá con él."
            : "Ya estás registrado. El dueño de la tienda tiene que aprobarte y asignarte un rol desde Usuarios. Cuando lo haga, volvé a entrar."}
        </p>
        <dl className="mt-6 border-t border-adm-border pt-4 text-[13px]">
          <dt className="text-adm-fg-muted">Ingresaste como</dt>
          <dd className="mt-0.5 font-medium">{email}</dd>
        </dl>
        <form action={signOut} className="mt-6">
          <Button type="submit">Cerrar sesión</Button>
        </form>
      </div>
    </div>
  );
}
