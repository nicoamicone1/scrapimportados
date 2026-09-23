import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthLayout } from "@/app/admin/AuthLayout";
import { getProfile, getSession, listMyStores } from "@/lib/auth";

import { NewStoreWizard } from "./NewStoreWizard";

export const metadata: Metadata = { title: "Nueva tienda" };
export const dynamic = "force-dynamic";

/** Wizard de alta (spec §14.3): nombre + dirección + rubro → contacto → cobros → `create_store()`. */
export default async function NuevaTiendaPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/app/nueva");
  const [profile, stores] = await Promise.all([getProfile(), listMyStores()]);
  const owned = stores.filter((s) => s.role === "owner").length;

  return (
    <AuthLayout
      panelTitle="Tres pasos y tu tienda queda online, con un estilo pensado para tu rubro."
      aside="Arrancás con 14 días de Pro: todas las funciones, sin tarjeta."
    >
      {owned >= 3 && !profile?.is_platform_admin ? (
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">Llegaste al máximo de tiendas</h1>
          <p className="mt-2 text-sm text-adm-fg-muted">Cada cuenta puede tener hasta 3 tiendas propias.</p>
          <Link href="/app" className="mt-6 inline-block text-sm font-medium text-adm-accent hover:underline">
            Volver a mis tiendas
          </Link>
        </div>
      ) : (
        <>
          <h1 className="mb-1 text-[22px] leading-7 font-semibold tracking-[-0.01em]">Creá tu tienda</h1>
          <p className="mb-6 text-sm text-adm-fg-muted">Lo que cargues acá lo podés cambiar después desde el panel.</p>
          <NewStoreWizard />
          {stores.length ? (
            <p className="mt-8 text-[13px] text-adm-fg-muted">
              <Link href="/app" className="text-adm-accent hover:underline">
                Volver a mis tiendas
              </Link>
            </p>
          ) : null}
        </>
      )}
    </AuthLayout>
  );
}
