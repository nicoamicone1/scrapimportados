import { ExternalLink, Printer } from "lucide-react";
import type { ReactNode } from "react";

import { AppArt } from "@/app/admin/(panel)/apps/_components/AppArt";
import { ModuleTabs } from "@/components/admin/print3d/ModuleTabs";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { hasModule, moduleState, MODULES } from "@/lib/modules/registry";
import { listStoreModuleRows } from "@/lib/modules/server";
import { storeHref } from "@/lib/tenant/urls";

const APP = MODULES.print3d;

/**
 * Guard + marco del Taller 3D. Sin la app: estado vacío que lleva a
 * /admin/apps. Con la app: barra del módulo y pestañas; cada página pone
 * su propio `PageHeader` debajo.
 *
 * El layout NO protege los datos (Next renderiza layout y página en
 * paralelo): cada lectura/acción del módulo igual llama `requireModule(ctx, "print3d")`.
 */
export default async function Taller3dLayout({ children }: { children: ReactNode }) {
  const ctx = await requireAdmin();
  const rows = await listStoreModuleRows(ctx.supabase, ctx.store.id);
  const row = rows.find((r) => r.code === "print3d");
  const state = moduleState(row ? { status: row.status, expires_at: row.expiresAt } : null);

  if (!hasModule(ctx, "print3d")) {
    return (
      <>
        <PageHeader title={APP.name} section="store" icon={<Printer />} />
        <div className="overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex items-center justify-center bg-adm-sidebar-bg px-8 py-8">
            <AppArt code="print3d" className="max-w-[260px] opacity-70" />
          </div>
          <div className="px-6 py-8">
            <p className="text-base font-semibold text-adm-fg">El Taller 3D no está activo en esta tienda</p>
            <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-adm-fg-muted">
              {state.kind === "expired"
                ? `La app venció el ${formatDate(state.expiresAt)}. Tus impresoras, bobinas y cotizaciones siguen guardadas: cuando la renueves, aparecen como las dejaste.`
                : "Con la app cotizás STL al instante desde tu tienda, ordenás la cola de cada impresora, llevás el filamento en gramos y sabés cuánto te costó cada pedido. Se activa a pedido."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href="/admin/apps" variant="primary">
                {state.kind === "expired" ? "Renovar desde Apps" : "Ver la app"}
              </ButtonLink>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-adm-sm bg-adm-sidebar-bg text-adm-accent-2 [&_svg]:size-3.5">
            <Printer />
          </span>
          <span className="text-[13px] font-semibold tracking-[0.02em] text-adm-fg">{APP.name}</span>
          {state.kind === "trial" ? (
            <Badge tone="amber">{state.expiresAt ? `Prueba hasta el ${formatDate(state.expiresAt)}` : "En prueba"}</Badge>
          ) : state.kind === "active" && state.expiresAt ? (
            <Badge tone="neutral">Activa hasta el {formatDate(state.expiresAt)}</Badge>
          ) : null}
          <a
            href={storeHref(ctx.store, `/${APP.storefrontPaths[0]}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[13px] text-adm-fg-muted hover:text-adm-fg"
          >
            Ver el cotizador en la tienda
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
        <ModuleTabs className="mt-2" />
      </div>
      {children}
    </>
  );
}
