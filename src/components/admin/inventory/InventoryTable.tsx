"use client";

import { History, MoreHorizontal, Pencil, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Thumb } from "@/components/admin/products/Thumb";
import { UrlSelect, useUrlFilters } from "@/components/admin/products/url-filters";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DropdownItem, DropdownMenu } from "@/components/ui/DropdownMenu";
import { Checkbox } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import type { AdminInventoryRow } from "@/lib/admin/catalog-db";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";

import { AdjustStockDialog, type AdjustTarget } from "./AdjustStockDialog";

export function StockStateBadge({ state }: { state: AdminInventoryRow["stock_state"] }) {
  if (state === "untracked") return <Badge tone="neutral">Sin seguimiento</Badge>;
  return <StatusBadge kind="stock" value={state} />;
}

export function InventoryTable({
  items,
  total,
  page,
  perPage,
  categories,
  hasFilters,
}: {
  items: AdminInventoryRow[];
  total: number;
  page: number;
  perPage: number;
  categories: { id: string; path: string }[];
  hasFilters: boolean;
}) {
  const router = useRouter();
  const { clear } = useUrlFilters();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adjust, setAdjust] = useState<AdjustTarget | null>(null);

  const ids = items.map((i) => i.variant_id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const labelOf = (r: AdminInventoryRow) => (r.variant_title === "Default" ? r.product_name : `${r.product_name} · ${r.variant_title}`);

  return (
    <>
      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-2">
        {someSelected ? (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-adm border border-adm-border bg-adm-surface-2 px-2 py-1">
            <span className="tnum px-1 text-[13px] font-medium">
              {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
            </span>
            <span aria-hidden className="h-4 w-px bg-adm-border" />
            <Button
              size="sm"
              variant="ghost"
              icon={<SlidersHorizontal />}
              onClick={() => setAdjust({ kind: "bulk", variantIds: [...selected] })}
            >
              Ajustar stock
            </Button>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Deseleccionar
            </Button>
          </div>
        ) : (
          <>
            <SearchInput placeholder="Buscar por producto, variante o SKU" className="sm:w-[280px]" />
            <UrlSelect
              param="categoria"
              label="Categoría"
              placeholder="Todas las categorías"
              options={categories.map((c) => ({ value: c.id, label: c.path }))}
              className="sm:max-w-56"
            />
            <UrlSelect
              param="orden"
              label="Ordenar"
              placeholder="Últimos cambios"
              options={[
                { value: "stock", label: "Stock: menor a mayor" },
                { value: "stock-desc", label: "Stock: mayor a menor" },
                { value: "producto", label: "Producto (A-Z)" },
              ]}
            />
            {hasFilters ? (
              <Button size="sm" variant="ghost" icon={<X />} onClick={() => clear(["estado"])}>
                Limpiar filtros
              </Button>
            ) : null}
          </>
        )}
      </div>

      <Table containerClassName="max-h-[calc(100dvh-19rem)] min-h-40">
        <THead>
          <tr>
            <TH className="w-10 pr-0">
              <Checkbox
                aria-label="Seleccionar todas"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={() => setSelected(allSelected ? new Set() : new Set(ids))}
              />
            </TH>
            <TH>Producto</TH>
            <TH className="hidden md:table-cell">SKU</TH>
            <TH numeric>Stock</TH>
            <TH numeric className="hidden sm:table-cell">
              Umbral
            </TH>
            <TH className="hidden md:table-cell">Estado</TH>
            <TH className="hidden lg:table-cell">Actualizado</TH>
            <TH className="w-10">
              <span className="sr-only">Acciones</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <TableEmpty
              colSpan={8}
              title={hasFilters ? "No hay variantes con estos filtros." : "No hay variantes en este estado."}
              description={hasFilters ? "Probá con otra búsqueda o sacá algún filtro." : "Buena señal: no hay nada para reponer acá."}
              action={
                hasFilters ? (
                  <Button size="sm" onClick={() => clear()}>
                    Limpiar filtros
                  </Button>
                ) : undefined
              }
            />
          ) : (
            items.map((r) => (
              <TR key={r.variant_id} selected={selected.has(r.variant_id)}>
                <TD className="w-10 pr-0">
                  <Checkbox
                    aria-label={`Seleccionar ${labelOf(r)}`}
                    checked={selected.has(r.variant_id)}
                    onChange={() => toggle(r.variant_id)}
                  />
                </TD>
                <TD className="max-w-0 min-w-56 py-1">
                  <div className="flex items-center gap-3">
                    <Thumb url={r.image_url} size={32} />
                    <div className="min-w-0">
                      <Link href={`/admin/productos/${r.product_id}`} className="block truncate font-medium hover:underline" title={r.product_name}>
                        {r.product_name}
                      </Link>
                      <p className="truncate text-xs text-adm-fg-muted">
                        {r.variant_title !== "Default" ? r.variant_title : "Variante única"}
                        {!r.is_active ? " · Inactiva" : ""}
                        {r.product_status !== "active" ? ` · ${r.product_status === "draft" ? "Borrador" : "Archivado"}` : ""}
                        <span className="font-mono md:hidden">{r.sku ? ` · ${r.sku}` : ""}</span>
                      </p>
                    </div>
                  </div>
                </TD>
                <TD className="hidden font-mono text-xs md:table-cell" muted>
                  {r.sku ?? "—"}
                </TD>
                <TD numeric>
                  {r.track_inventory ? (
                    <button
                      type="button"
                      onClick={() => setAdjust({ kind: "single", variantId: r.variant_id, label: labelOf(r), stock: r.stock })}
                      title="Ajustar stock"
                      aria-label={`Stock de ${labelOf(r)}: ${r.stock}. Ajustar`}
                      className={cn(
                        "tnum -mr-1.5 inline-flex h-7 min-w-10 items-center justify-end rounded-adm px-1.5 font-medium hover:bg-adm-surface-2 hover:ring-1 hover:ring-adm-input-border",
                        r.stock_state === "out" && "text-adm-danger",
                        r.stock_state === "low" && "text-adm-warning",
                      )}
                    >
                      {formatNumber(r.stock)}
                    </button>
                  ) : (
                    <span className="text-adm-fg-muted">—</span>
                  )}
                </TD>
                <TD numeric muted className="hidden sm:table-cell">
                  {r.track_inventory ? (
                    <span title={r.low_stock_threshold === null ? "Umbral general de la tienda" : "Umbral propio de la variante"}>
                      {formatNumber(r.threshold)}
                      {r.low_stock_threshold === null ? <span className="ml-0.5 text-[11px]">*</span> : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="hidden md:table-cell">
                  <StockStateBadge state={r.stock_state} />
                </TD>
                <TD className="hidden whitespace-nowrap lg:table-cell" muted>
                  <time suppressHydrationWarning dateTime={r.updated_at} title={formatDateTime(r.updated_at)}>
                    {formatRelative(r.updated_at)}
                  </time>
                </TD>
                <TD className="w-10 pl-0 text-right">
                  <DropdownMenu
                    width={220}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${labelOf(r)}`}>
                        <MoreHorizontal />
                      </Button>
                    }
                  >
                    {r.track_inventory ? (
                      <DropdownItem
                        icon={<SlidersHorizontal />}
                        onSelect={() => setAdjust({ kind: "single", variantId: r.variant_id, label: labelOf(r), stock: r.stock })}
                      >
                        Ajustar stock
                      </DropdownItem>
                    ) : null}
                    <DropdownItem icon={<History />} href={`/admin/inventario/movimientos?variante=${r.variant_id}`}>
                      Ver movimientos
                    </DropdownItem>
                    <DropdownItem icon={<Pencil />} href={`/admin/productos/${r.product_id}`}>
                      Editar producto
                    </DropdownItem>
                  </DropdownMenu>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-adm-fg-muted">* Usa el umbral general de la tienda.</p>
          <Pagination page={page} perPage={perPage} total={total} className="flex-1 sm:flex-none" />
        </div>
      ) : null}

      <AdjustStockDialog
        target={adjust}
        onOpenChange={(o) => !o && setAdjust(null)}
        onDone={() => {
          if (adjust?.kind === "bulk") setSelected(new Set());
          router.refresh();
        }}
      />
    </>
  );
}
