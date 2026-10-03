import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountAside, AccountShell, StoreGlimpse } from "@/components/platform/AccountShell";
import { TEXT_LINK } from "@/components/platform/brand";
import { getSession } from "@/lib/auth";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Creá tu tienda gratis",
  description: "Creá tu cuenta y armá tu tienda online: 14 días de Pro gratis, sin tarjeta y sin comisión por venta.",
  alternates: { canonical: "/registro" },
};
export const dynamic = "force-dynamic";

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;
  const email = typeof params.email === "string" ? params.email.toLowerCase() : undefined;
  // Con `next` (p. ej. una invitación) el registro no sigue al alta de tienda.
  const createsStore = !next || next.startsWith("/app/nueva");

  const { user } = await getSession();
  if (user) redirect(next ?? "/app/nueva");

  return (
    <AccountShell
      aside={
        <AccountAside
          tone="durazno"
          eyebrow="Tu tienda en una tarde"
          title="Te pagan a vos. Ecommy no toca la plata."
          points={[
            "14 días de Pro con todas las funciones, sin tarjeta.",
            "Sin comisión por venta: transferencia, WhatsApp o tu Mercado Pago.",
            "Si no elegís un plan, pasás a Free y no se borra nada.",
          ]}
          visual={<StoreGlimpse />}
        />
      }
    >
      <RegisterForm next={next} initialEmail={email} createsStore={createsStore} />
      <p className="mt-10 border-t border-eco-line pt-6 text-[14px] text-adm-fg-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={TEXT_LINK}>
          Ingresá
        </Link>
      </p>
    </AccountShell>
  );
}
