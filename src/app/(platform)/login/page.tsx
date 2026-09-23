import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthLayout } from "@/app/admin/AuthLayout";
import { getSession } from "@/lib/auth";

import { LoginForm } from "./LoginForms";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

function safeNext(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const linkError = params.error === "link";
  const email = typeof params.email === "string" ? params.email : undefined;

  const { user } = await getSession();
  if (user) redirect(next);

  return (
    <AuthLayout aside="Una cuenta, todas tus tiendas: elegís cuál administrar desde el panel.">
      {linkError ? (
        <p role="alert" className="mb-6 rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2 text-[13px]">
          El link venció o ya se usó. Pedí uno nuevo desde «¿Olvidaste tu contraseña?».
        </p>
      ) : null}
      <LoginForm next={next} initialEmail={email} />
      <p className="mt-8 text-[13px] text-adm-fg-muted">
        ¿Todavía no tenés cuenta?{" "}
        <Link href={`/registro${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-adm-accent hover:underline">
          Creá tu tienda gratis
        </Link>
        .
      </p>
    </AuthLayout>
  );
}
