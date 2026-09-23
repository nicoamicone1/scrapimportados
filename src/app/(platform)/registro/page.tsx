import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthLayout } from "@/app/admin/AuthLayout";
import { getSession } from "@/lib/auth";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Creá tu tienda" };
export const dynamic = "force-dynamic";

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;
  const email = typeof params.email === "string" ? params.email.toLowerCase() : undefined;

  const { user } = await getSession();
  if (user) redirect(next ?? "/app/nueva");

  return (
    <AuthLayout
      panelTitle="Tu tienda online en diez minutos. Con tu marca, tus precios y tu forma de cobrar."
      aside="14 días de Pro gratis. Después elegís plan o seguís en Free."
    >
      <RegisterForm next={next} initialEmail={email} />
      <p className="mt-8 text-[13px] text-adm-fg-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-adm-accent hover:underline">
          Ingresá
        </Link>
        .
      </p>
    </AuthLayout>
  );
}
