import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { AccountAside, AccountShell } from "@/components/platform/AccountShell";
import { DISPLAY, FormAlert } from "@/components/platform/brand";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import { getSession } from "@/lib/auth";
import { createPublicClient } from "@/lib/supabase/server";

import { acceptInvite } from "./actions";

export const metadata: Metadata = { title: "Invitación" };
export const dynamic = "force-dynamic";

const TITLE = cn(DISPLAY, "text-[28px] leading-tight font-semibold tracking-[-0.02em]");

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
    <AccountShell
      aside={
        <AccountAside
          eyebrow="Invitación"
          title="Te sumaron a un equipo en Ecommy."
          points={["Ves y trabajás la tienda según el rol que te dieron.", "Con una sola cuenta entrás a todas las tiendas donde te sumen."]}
        />
      }
    >
      {!invite ? (
        <div>
          <h1 className={TITLE}>La invitación no existe</h1>
          <p className="mt-2 text-sm text-adm-fg-muted">Puede que ya la hayas usado o que la hayan anulado. Pedile a quien te invitó un link nuevo.</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-adm-accent hover:underline">
            Ir a ingresar
          </Link>
        </div>
      ) : invite.expired ? (
        <div>
          <h1 className={TITLE}>La invitación venció</h1>
          <p className="mt-2 text-sm text-adm-fg-muted">Las invitaciones duran 7 días. Pedile a quien te invitó a {invite.store_name} que te mande una nueva.</p>
        </div>
      ) : (
        <div>
          <h1 className={TITLE}>Sumate a {invite.store_name}</h1>
          <p className="mt-2 text-sm text-adm-fg-muted">
            Te invitaron como <span className="font-medium text-adm-fg">{roleLabel}</span> con el email{" "}
            <span className="font-medium text-adm-fg">{invite.email}</span>.
          </p>
          {error ? (
            <FormAlert className="mt-4">{error}</FormAlert>
          ) : null}
          {!user ? (
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={`/registro?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(here)}`}
                className="inline-flex h-11 items-center justify-center rounded-adm bg-adm-accent px-4 text-[15px] font-medium text-adm-accent-fg hover:bg-adm-accent-hover"
              >
                Crear mi cuenta
              </Link>
              <Link
                href={`/login?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(here)}`}
                className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-adm-accent underline underline-offset-4 hover:no-underline"
              >
                Ya tengo cuenta, ingresar
              </Link>
            </div>
          ) : user.email?.toLowerCase() === invite.email ? (
            <form action={acceptInvite} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <SubmitButton size="lg" className="h-11 w-full text-[15px]" pendingText="Uniéndote…">
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
    </AccountShell>
  );
}
