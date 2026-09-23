import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { AuthLayout } from "@/app/admin/AuthLayout";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getSession } from "@/lib/auth";
import { createPublicClient } from "@/lib/supabase/server";

import { acceptInvite } from "./actions";

export const metadata: Metadata = { title: "Invitación" };
export const dynamic = "force-dynamic";

interface Invite {
  store_name: string;
  store_slug: string;
  email: string;
  role: string;
  expired: boolean;
}

function isInvite(v: unknown): v is Invite {
  return Boolean(v) && typeof v === "object" && typeof (v as Invite).email === "string";
}

/**
 * `/invitacion/<token>`: si hay sesión con el email invitado, acepta; si no
 * hay sesión, ofrece registrarse (email prellenado) o ingresar.
 */
export default async function InvitacionPage({ params, searchParams }: PageProps<"/invitacion/[token]">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const error = typeof query.error === "string" ? query.error : null;
  const { data } = await createPublicClient().rpc("get_store_invite", { p_token: token });
  const invite = isInvite(data) ? data : null;
  const { user } = await getSession();
  const here = `/invitacion/${token}`;
  const roleLabel = invite?.role === "admin" ? "administrador" : "staff";

  return (
    <AuthLayout panelTitle="Te sumaron a un equipo en Ecommy.">
      {!invite ? (
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">La invitación no existe</h1>
          <p className="mt-2 text-sm text-adm-fg-muted">Puede que ya la hayas usado o que la hayan anulado. Pedile a quien te invitó un link nuevo.</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-adm-accent hover:underline">
            Ir a ingresar
          </Link>
        </div>
      ) : invite.expired ? (
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">La invitación venció</h1>
          <p className="mt-2 text-sm text-adm-fg-muted">Las invitaciones duran 7 días. Pedile a quien te invitó a {invite.store_name} que te mande una nueva.</p>
        </div>
      ) : (
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">Sumate a {invite.store_name}</h1>
          <p className="mt-2 text-sm text-adm-fg-muted">
            Te invitaron como <span className="font-medium text-adm-fg">{roleLabel}</span> con el email{" "}
            <span className="font-medium text-adm-fg">{invite.email}</span>.
          </p>
          {error ? (
            <p role="alert" className="mt-4 rounded-adm border border-[#efc6c0] bg-adm-danger-soft px-3 py-2 text-[13px] text-[#8f1c13]">
              {error}
            </p>
          ) : null}
          {!user ? (
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={`/registro?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(here)}`}
                className="inline-flex h-9 items-center justify-center rounded-adm bg-adm-accent px-3.5 text-sm font-medium text-adm-accent-fg hover:bg-adm-accent-hover"
              >
                Crear mi cuenta
              </Link>
              <Link
                href={`/login?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(here)}`}
                className="text-center text-sm font-medium text-adm-accent hover:underline"
              >
                Ya tengo cuenta, ingresar
              </Link>
            </div>
          ) : user.email?.toLowerCase() === invite.email ? (
            <form action={acceptInvite} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <SubmitButton size="lg" className="w-full" pendingText="Uniéndote…">
                Aceptar y entrar al panel
              </SubmitButton>
            </form>
          ) : (
            <div className="mt-6 text-sm">
              <p className="text-adm-fg-muted">
                Ingresaste como <span className="font-medium text-adm-fg">{user.email}</span>. La invitación es para otro email.
              </p>
              <form action={signOut} className="mt-4">
                <SubmitButton variant="secondary" pendingText="Saliendo…">
                  Salir y usar {invite.email}
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
