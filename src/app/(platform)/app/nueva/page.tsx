import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountShell } from "@/components/platform/AccountShell";
import { DISPLAY } from "@/components/platform/brand";
import { getProfile, getSession, listMyStores } from "@/lib/auth";
import { cn } from "@/lib/cn";

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
          <h1 className={cn(DISPLAY, "text-[28px] leading-tight font-semibold tracking-[-0.02em]")}>Llegaste al máximo de tiendas</h1>
          <p className="mt-2 text-sm leading-relaxed text-adm-fg-muted">
            Cada cuenta puede tener hasta {MAX_STORES} tiendas propias. Si necesitás más, el plan Business se arma a medida.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/app"
              className="inline-flex h-11 items-center rounded-adm bg-adm-accent px-4 text-[15px] font-medium text-adm-accent-fg hover:bg-adm-accent-hover"
            >
              Volver a mis tiendas
            </Link>
            <Link href="/contacto#business" className="text-sm font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
              Consultar por Business
            </Link>
          </div>
        </div>
      ) : (
        <>
          <NewStoreWizard firstStore={stores.length === 0} />
          {stores.length ? (
            <p className="mt-8 text-[13px] text-adm-fg-muted">
              <Link href="/app" className="inline-flex min-h-11 items-center text-adm-accent underline underline-offset-4 hover:no-underline md:min-h-0">
                Volver a mis tiendas
              </Link>
            </p>
          ) : null}
        </>
      )}
    </AccountShell>
  );
}
