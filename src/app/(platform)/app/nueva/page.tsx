import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ACCOUNT_TITLE, AccountShell } from "@/components/platform/AccountShell";
import { TEXT_LINK } from "@/components/platform/brand";
import { PlanCtaLink } from "@/components/platform/PlanCards";
import { getProfile, getSession, listMyStores } from "@/lib/auth";

import { NewStoreWizard } from "./NewStoreWizard";

export const metadata: Metadata = { title: "Nueva tienda" };
export const dynamic = "force-dynamic";

const MAX_STORES = 3;

/** Alta de tienda (spec §14.3): nombre + rubro → WhatsApp y cobros → `create_store()`. */
export default async function NuevaTiendaPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/app/nueva");
  const [profile, stores] = await Promise.all([getProfile(), listMyStores()]);
  const owned = stores.filter((s) => s.role === "owner").length;

  return (
    <AccountShell wide>
      {owned >= MAX_STORES && !profile?.is_platform_admin ? (
        <div className="max-w-[440px]">
          <h1 className={ACCOUNT_TITLE}>Llegaste al máximo de tiendas</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
            Cada cuenta puede tener hasta {MAX_STORES} tiendas propias. Si necesitás más, el plan Business se arma a medida.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="w-full sm:w-auto">
              <PlanCtaLink href="/app">Volver a mis tiendas</PlanCtaLink>
            </div>
            <Link href="/contacto#business" className={TEXT_LINK}>
              Consultar por Business
            </Link>
          </div>
        </div>
      ) : (
        <>
          <NewStoreWizard firstStore={stores.length === 0} />
          {stores.length ? (
            <p className="mt-8 text-[14px]">
              <Link href="/app" className={`${TEXT_LINK} inline-flex min-h-11 items-center md:min-h-0`}>
                Volver a mis tiendas
              </Link>
            </p>
          ) : null}
        </>
      )}
    </AccountShell>
  );
}
