import { signOut } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** Pantalla para cuentas `pending` (o desactivadas): sin acceso al panel. */
export function PendingApproval({ email, inactive }: { email: string; inactive?: boolean }) {
  return (
    <div className="flex min-h-dvh items-start px-4 py-16 sm:px-12 sm:py-24">
      <div className="w-full max-w-[460px] rounded-adm border border-adm-border bg-adm-surface p-6 shadow-adm-card sm:p-8">
        <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.07em] text-adm-fg-muted uppercase">
          <span aria-hidden className={inactive ? "size-1.5 rounded-full bg-adm-danger" : "size-1.5 rounded-full bg-adm-accent-2"} />
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
          <SubmitButton variant="secondary" pendingText="Cerrando sesión…">
            Cerrar sesión
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
