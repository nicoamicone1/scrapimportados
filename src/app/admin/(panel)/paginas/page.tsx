import { House } from "lucide-react";
import type { Metadata } from "next";

import { NewPageDialog } from "@/components/admin/builder/NewPageDialog";
import { PagesTable } from "@/components/admin/builder/PagesTable";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { SearchInput } from "@/components/ui/SearchInput";
import { TabsNav } from "@/components/ui/Tabs";
import { getHomePageId, listAdminPages, type PageFilter } from "@/lib/admin/pages";

export const metadata: Metadata = { title: "Páginas" };

const FILTERS: { value: PageFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "publicadas", label: "Publicadas" },
  { value: "borradores", label: "Borradores" },
];

export default async function PagesPage({ searchParams }: PageProps<"/admin/paginas">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const estado = (FILTERS.find((f) => f.value === params.estado)?.value ?? "todas") as PageFilter;
  const [pages, all, homeId] = await Promise.all([listAdminPages({ q, estado }), listAdminPages(), getHomePageId()]);

  const published = all.filter((p) => p.status === "published").length;
  const href = (value: PageFilter) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (value !== "todas") sp.set("estado", value);
    const qs = sp.toString();
    return qs ? `/admin/paginas?${qs}` : "/admin/paginas";
  };

  return (
    <>
      <PageHeader
        title="Páginas"
        description={`${all.length} ${all.length === 1 ? "página" : "páginas"} · ${published} publicadas`}
        actions={
          <>
            {homeId ? (
              <ButtonLink href={`/admin/paginas/${homeId}`} icon={<House />}>
                Editar portada
              </ButtonLink>
            ) : null}
            <NewPageDialog />
          </>
        }
      >
        <TabsNav
          items={FILTERS.map((f) => ({
            href: href(f.value),
            label: f.label,
            active: f.value === estado,
            count: f.value === "todas" ? all.length : f.value === "publicadas" ? published : all.length - published,
          }))}
        />
      </PageHeader>
      <div className="mb-3 flex items-center gap-2">
        <SearchInput placeholder="Buscar por título o dirección" className="w-full max-w-[280px]" aria-label="Buscar páginas" />
      </div>
      <PagesTable pages={pages} filtered={Boolean(q) || estado !== "todas"} />
    </>
  );
}
