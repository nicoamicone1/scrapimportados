import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { ACCOUNT_TITLE, AccountAside, AccountShell, PanelGlimpse, SITE_SUBMIT } from "@/components/platform/AccountShell";
import { FormAlert, TEXT_LINK } from "@/components/platform/brand";
import { PlanCtaLink } from "@/components/platform/PlanCards";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TRANSFER_LINK_DAYS } from "@/lib/admin/transfer";
import { getSession } from "@/lib/auth";
import { createPublicClient } from "@/lib/supabase/server";

import { acceptTransfer } from "./actions";

export const metadata: Metadata = { title: "Recibir una tienda" };
export const dynamic = "force-dynamic";

const TITLE = ACCOUNT_TITLE;

interface Transfer {
  store_name: string;
  store_slug: string;
  email: string;
  from_name: string | null;
  keep_previous: boolean;
  status: "pending" | "accepted" | "cancelled";
  expired: boolean;
}

function isTransfer(v: unknown): v is Transfer {
  return Boolean(v) && typeof v === "object" && typeof (v as Transfer).email === "string" && typeof (v as Transfer).status === "string";
}

/**
 * `/invitacion/tienda/<token>`: el dueño de una tienda te la pasa (migración
 * 0024). Con sesión del email del link, se acepta; sin sesión, registrarse
 * (email prellenado) o ingresar.
 */
export default async function RecibirTiendaPage({ params, searchParams }: PageProps<"/invitacion/tienda/[token]">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const error = typeof query.error === "string" ? query.error : null;
  const { data } = await createPublicClient().rpc("get_store_transfer", { p_token: token });
  const transfer = isTransfer(data) ? data : null;
  const { user } = await getSession();
  const here = `/invitacion/tienda/${token}`;
  const from = transfer?.from_name || "Quien te la pasa";

  return (
    <AccountShell
      aside={
        <AccountAside
          eyebrow="Te pasan una tienda"
          title="Una tienda lista, a tu nombre."
          points={[
            "Productos, páginas, estilo y pedidos quedan como están.",
            "Tenés control total: el panel, el plan y quién más entra.",
            "Con una sola cuenta manejás hasta 3 tiendas a tu nombre.",
          ]}
          visual={<PanelGlimpse />}
        />
      }
    >
      {!transfer || transfer.status === "cancelled" ? (
        <div>
          <h1 className={TITLE}>El link no existe</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
            Puede que lo hayan anulado o que la tienda ya no esté. Pedile a quien te la pasa un link nuevo.
          </p>
          <Link href="/login" className={`${TEXT_LINK} mt-6 inline-flex min-h-11 items-center`}>
            Ir a ingresar
          </Link>
        </div>
      ) : transfer.status === "accepted" ? (
        <div>
          <h1 className={TITLE}>{transfer.store_name} ya cambió de dueño</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">Este link ya se usó. Si la recibiste vos, la encontrás en tu panel.</p>
          <Link href="/admin" className={`${TEXT_LINK} mt-6 inline-flex min-h-11 items-center`}>
            Ir al panel
          </Link>
        </div>
      ) : transfer.expired ? (
        <div>
          <h1 className={TITLE}>El link venció</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
            Los links para recibir una tienda duran {TRANSFER_LINK_DAYS} días. Pedile a quien te pasa {transfer.store_name} que te mande uno nuevo.
          </p>
        </div>
      ) : (
        <div>
          <h1 className={TITLE}>Recibí {transfer.store_name}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
            {from} te pasa la tienda para que la sigas vos, con todo lo que tiene cargado. Queda a nombre de{" "}
            <span className="font-medium text-adm-fg">{transfer.email}</span>
            {transfer.keep_previous ? `; ${from} sigue en el equipo como administrador (podés cambiarle el rol o sacarle el acceso cuando quieras).` : "."}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
            Después, revisá cómo cobrás (CBU o alias, WhatsApp) y el email de contacto de la tienda: siguen los que cargó {from}.
          </p>
          {error ? <FormAlert className="mt-4">{error}</FormAlert> : null}
          {!user ? (
            <div className="mt-8 flex flex-col gap-3">
              <PlanCtaLink href={`/registro?email=${encodeURIComponent(transfer.email)}&next=${encodeURIComponent(here)}`} primary>
                Crear mi cuenta
              </PlanCtaLink>
              <Link
                href={`/login?email=${encodeURIComponent(transfer.email)}&next=${encodeURIComponent(here)}`}
                className={`${TEXT_LINK} inline-flex min-h-11 items-center justify-center text-[15px]`}
              >
                Ya tengo cuenta, ingresar
              </Link>
            </div>
          ) : user.email?.toLowerCase() === transfer.email ? (
            <form action={acceptTransfer} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <SubmitButton size="lg" className={SITE_SUBMIT} pendingText="Pasando la tienda…">
                Recibir la tienda y entrar al panel
              </SubmitButton>
            </form>
          ) : (
            <div className="mt-6 text-sm">
              <p className="text-adm-fg-muted">
                Ingresaste como <span className="font-medium text-adm-fg">{user.email}</span>. El link es para otro email.
              </p>
              <form action={signOut} className="mt-4">
                <SubmitButton variant="secondary" size="lg" className="h-11 rounded-full px-5" pendingText="Saliendo…">
                  Salir y usar {transfer.email}
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      )}
    </AccountShell>
  );
}
