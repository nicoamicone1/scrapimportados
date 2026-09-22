import { Import, Plus } from "lucide-react";
import type { Metadata } from "next";

import { ProductsTable } from "@/components/admin/products/ProductsTable";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { TabsNav } from "@/components/ui/Tabs";
import { listCategoryOptions } from "@/lib/admin/categories";
import { categoryPath, flattenTree } from "@/lib/admin/category-tree";
import { getProductCounts, listAdminProducts, parseProductFilters } from "@/lib/admin/products";
import { formatNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Productos" };

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
  return qs ? `/admin/productos?${qs}` : "/admin/productos";
}

export default async function ProductsPage({ searchParams }: PageProps<"/admin/productos">) {
  const params = (await searchParams) as Params;
  const filters = parseProductFilters(params);
  const [list, counts, categoryRows] = await Promise.all([
    listAdminProducts(filters),
    getProductCounts(),
    listCategoryOptions(),
  ]);

  const categories = flattenTree(categoryRows).map((f) => ({
    id: f.id,
    name: f.item.name,
    path: categoryPath(categoryRows, f.id),
  }));
  const hasFilters = Boolean(filters.q || filters.categoryId || filters.stock || filters.source || params.orden);
  const estado = typeof params.estado === "string" ? params.estado : "";

  const actions = (
    <>
      <ButtonLink href="/admin/importar" icon={<Import />}>
        Importar
      </ButtonLink>
      <ButtonLink href="/admin/productos/nuevo" variant="primary" icon={<Plus />}>
        Nuevo producto
      </ButtonLink>
    </>
  );

  if (counts.all === 0) {
    return (
      <>
        <PageHeader title="Productos" actions={actions} />
        <EmptyState
          title="Todavía no tenés productos"
          description="Cargá el primero a mano o traé tu catálogo desde otra tienda (WooCommerce, Shopify o una planilla)."
          actions={
            <>
              <ButtonLink href="/admin/productos/nuevo" variant="primary">
                Nuevo producto
              </ButtonLink>
              <ButtonLink href="/admin/importar">Importar catálogo</ButtonLink>
            </>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Productos"
        description={`${formatNumber(counts.active)} activos · ${formatNumber(counts.draft)} en borrador · ${formatNumber(counts.outOfStock)} sin stock`}
        actions={actions}
      >
        <TabsNav
          label="Estado"
          // pb-px: evita el scroll vertical de 1px del TabsNav (el subrayado usa -mb-px).
          className="pb-px"
          items={[
            { href: hrefWith(params, { estado: null }), label: "Todos", active: !estado, count: counts.all },
            { href: hrefWith(params, { estado: "activos" }), label: "Activos", active: estado === "activos", count: counts.active },
            { href: hrefWith(params, { estado: "borradores" }), label: "Borradores", active: estado === "borradores", count: counts.draft },
            { href: hrefWith(params, { estado: "archivados" }), label: "Archivados", active: estado === "archivados", count: counts.archived },
          ]}
        />
      </PageHeader>
      <ProductsTable
        // La selección se reinicia al cambiar filtros o página.
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
