import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountAside, AccountShell, PanelGlimpse } from "@/components/platform/AccountShell";
import { TEXT_LINK } from "@/components/platform/brand";
import { getSession } from "@/lib/auth";

import { LoginForm } from "./LoginForms";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Sin `next`, al panel: `/admin` abre la última tienda usada (o la primera) y
 * sin tiendas manda al alta. Antes pasaba por "Mis tiendas", un clic más
 * para el caso más común (una sola tienda); el selector sigue en `/app`.
 */
const DEFAULT_NEXT = "/admin";

function safeNext(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : DEFAULT_NEXT;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const linkError = params.error === "link";
  const email = typeof params.email === "string" ? params.email : undefined;

  const { user } = await getSession();
  if (user) redirect(next);

  return (
    <AccountShell
      aside={
        <AccountAside
          eyebrow="Tu panel"
          title="Una cuenta, todas tus tiendas."
          points={[
            "Entrás directo a la última tienda que usaste.",
            "Pedidos con número, estado y pago en una fila.",
            "Hasta 3 tiendas propias por cuenta.",
          ]}
          visual={<PanelGlimpse />}
        />
      }
    >
      {linkError ? (
        <p role="alert" className="mb-8 rounded-[16px] rounded-bl-[4px] bg-eco-pomelo-soft px-4 py-3 text-[14px] leading-snug text-eco-ink">
          El link venció o ya se usó. Pedí uno nuevo desde «¿La olvidaste?», junto a la contraseña.
        </p>
      ) : null}
      <LoginForm next={next} initialEmail={email} />
      <p className="mt-10 border-t border-eco-line pt-6 text-[14px] text-adm-fg-muted">
        ¿Todavía no tenés cuenta?{" "}
        <Link
          href={`/registro${next !== DEFAULT_NEXT ? `?next=${encodeURIComponent(next)}` : ""}`}
          className={TEXT_LINK}
        >
          Creá tu tienda gratis
        </Link>
      </p>
    </AccountShell>
  );
}
