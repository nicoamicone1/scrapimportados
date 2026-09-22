import type { Metadata } from "next";

import { RedirectsManager } from "@/components/admin/settings/RedirectsManager";
import { SettingsHeader } from "@/components/admin/settings/SettingsHeader";
import { listRedirects, REDIRECTS_PER_PAGE } from "@/lib/admin/settings";
import { formatNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Redirecciones 301 · Configuración" };

export default async function RedireccionesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const { rows, total } = await listRedirects({ q, page });

  return (
    <>
      <SettingsHeader
        title="Redirecciones 301"
        parent={{ label: "SEO e integraciones", href: "/admin/configuracion/seo" }}
        description={`${formatNumber(total)} ${total === 1 ? "redirección" : "redirecciones"}${q ? " con este filtro" : ""} · mandan las URLs viejas a las nuevas sin perder posicionamiento.`}
      />
      <RedirectsManager rows={rows} total={total} page={page} perPage={REDIRECTS_PER_PAGE} query={q} />
    </>
  );
}
