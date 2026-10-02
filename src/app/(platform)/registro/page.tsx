import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountAside, AccountShell, ReceiptMini } from "@/components/platform/AccountShell";
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
          eyebrow="Sin comisión por venta"
          title="Te pagan a vos. Ecommy no toca la plata."
          points={[
            "14 días de Pro con todas las funciones. Sin tarjeta ni datos de pago.",
            "El pedido queda registrado y te llega por WhatsApp con el total y la dirección.",
            "Si no elegís plan, pasás a Free y no se borra nada.",
          ]}
        >
          <ReceiptMini />
        </AccountAside>
      }
    >
      <RegisterForm next={next} initialEmail={email} createsStore={createsStore} />
      <p className="mt-8 text-[13px] text-adm-fg-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
          Ingresá
        </Link>
      </p>
    </AccountShell>
  );
}
