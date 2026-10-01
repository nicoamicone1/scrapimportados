import { Download, History } from "lucide-react";
import type { Metadata } from "next";

import { InventoryTable } from "@/components/admin/inventory/InventoryTable";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { TabsNav } from "@/components/ui/Tabs";
import { listCategoryOptions } from "@/lib/admin/categories";
import { categoryPath, flattenTree } from "@/lib/admin/category-tree";
import { getInventorySummary, listInventory, parseInventoryFilters } from "@/lib/admin/inventory";
import { formatMoney, formatNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Inventario" };

type Params = Record<string, string | string[] | undefined>;

function hrefWith(params: Params, patch: Record<string, string | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page") continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value) sp.set(k, value);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v) sp.set(k, v);
    else sp.delete(k);
  }
  const qs = sp.toString();
  return qs ? `/admin/inventario?${qs}` : "/admin/inventario";
}

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventario">) {
  const params = (await searchParams) as Params;
  const filters = parseInventoryFilters(params);
  const [list, summary, categoryRows] = await Promise.all([listInventory(filters), getInventorySummary(), listCategoryOptions()]);
  const categories = flattenTree(categoryRows).map((f) => ({ id: f.id, path: categoryPath(categoryRows, f.id) }));
  const hasFilters = Boolean(filters.q || filters.categoryId || params.orden);
  const estado = filters.state;

  return (
    <>
      <PageHeader
        title="Inventario"
        description={
          <>
            {summary.low || summary.out
              ? `${formatNumber(summary.out)} agotadas · ${formatNumber(summary.low)} con stock bajo`
              : "Nada por reponer"}
            {summary.withCost ? ` · ${formatMoney(summary.valueAtCost, { decimals: 0 })} de inventario a costo` : ""}
            {" · "}
            {formatNumber(summary.untracked)} sin seguimiento
          </>
        }
        actions={
          <>
            <ButtonLink href="/admin/configuracion/exportar" icon={<Download />}>
              Exportar CSV
            </ButtonLink>
            <ButtonLink href="/admin/inventario/movimientos" icon={<History />}>
              Movimientos
            </ButtonLink>
          </>
        }
      />

      <TabsNav
        label="Estado de stock"
        className="mb-4 pb-px"
        items={[
          { href: hrefWith(params, { estado: null }), label: "Todas", active: !estado },
          { href: hrefWith(params, { estado: "bajo" }), label: "Stock bajo", active: estado === "bajo", count: summary.low },
          { href: hrefWith(params, { estado: "agotado" }), label: "Agotadas", active: estado === "agotado", count: summary.out },
          {
            href: hrefWith(params, { estado: "sin-seguimiento" }),
            label: "Sin seguimiento",
            active: estado === "sin-seguimiento",
            count: summary.untracked,
          },
        ]}
      />

      <InventoryTable
        key={JSON.stringify(filters)}
        items={list.items}
        total={list.total}
        page={list.page}
        perPage={list.perPage}
        categories={categories}
        hasFilters={hasFilters}
      />
    </>
  );
}
