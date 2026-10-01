import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountAside, AccountShell } from "@/components/platform/AccountShell";
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
          points={["Entrás directo a la última tienda que usaste.", "Desde Mis tiendas cambiás de tienda o creás otra: hasta 3 por cuenta."]}
        />
      }
    >
      {linkError ? (
        <p role="alert" className="mb-6 rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2 text-[13px]">
          El link venció o ya se usó. Pedí uno nuevo desde «¿Olvidaste tu contraseña?».
        </p>
      ) : null}
      <LoginForm next={next} initialEmail={email} />
      <p className="mt-8 text-[13px] text-adm-fg-muted">
        ¿Todavía no tenés cuenta?{" "}
        <Link
          href={`/registro${next !== DEFAULT_NEXT ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-adm-accent underline underline-offset-4 hover:no-underline"
        >
          Creá tu tienda gratis
        </Link>
      </p>
    </AccountShell>
  );
}
