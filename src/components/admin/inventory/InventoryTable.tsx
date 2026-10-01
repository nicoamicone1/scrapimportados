"use client";

import { History, ListFilter, MoreHorizontal, Pencil, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { InlineNumber } from "@/components/admin/products/InlineNumber";
import { Thumb } from "@/components/admin/products/Thumb";
import { UrlSelect, useUrlFilters } from "@/components/admin/products/url-filters";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DropdownItem, DropdownMenu } from "@/components/ui/DropdownMenu";
import { Checkbox } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { PendingOverlay } from "@/components/ui/PendingOverlay";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import type { AdminInventoryRow } from "@/lib/admin/catalog-db";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";

import { adjustStock } from "@/app/admin/(panel)/inventario/actions";

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
  const { clear, get } = useUrlFilters();
  // La tabla se remonta al cambiar un filtro: si hay alguno activo, el panel sigue abierto.
  const [filtersOpen, setFiltersOpen] = useState(() => ["categoria", "orden"].some((k) => get(k)));
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

  /** Edición en el lugar: deja el stock en N (queda en movimientos como ajuste) y permite deshacer. */
  const saveStock = async (r: AdminInventoryRow, value: number) => {
    const before = r.stock;
    const res = await adjustStock({ variantId: r.variant_id, mode: "set", value, reason: "adjustment" });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(`Stock de ${labelOf(r)}: ${formatNumber(before)} → ${formatNumber(res.data.stock)}`, {
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: () => {
          void adjustStock({ variantId: r.variant_id, mode: "set", value: before, reason: "correction", note: "Se deshizo un ajuste" }).then((undo) => {
            if (undo.ok) {
              toast.success("Listo, se deshizo el ajuste");
              router.refresh();
            } else toast.error(undo.error);
          });
        },
      },
    });
    router.refresh();
    return true;
  };

  const labelOf = (r: AdminInventoryRow) => (r.variant_title === "Default" ? r.product_name : `${r.product_name} · ${r.variant_title}`);

  const activeFilterCount = ["categoria", "orden"].filter((k) => get(k)).length;
  const emptyTitle = hasFilters ? "No hay variantes con estos filtros." : "No hay variantes en este estado.";
  const emptyDescription = hasFilters ? "Probá con otra búsqueda o sacá algún filtro." : "Buena señal: no hay nada para reponer acá.";

  const menuFor = (r: AdminInventoryRow) => (
    <DropdownMenu
      width={232}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${labelOf(r)}`} className="max-md:size-11">
          <MoreHorizontal />
        </Button>
      }
    >
      {r.track_inventory ? (
        <DropdownItem
          icon={<SlidersHorizontal />}
          onSelect={() => setAdjust({ kind: "single", variantId: r.variant_id, label: labelOf(r), stock: r.stock })}
        >
          Sumar o restar con motivo…
        </DropdownItem>
      ) : null}
      <DropdownItem icon={<History />} href={`/admin/inventario/movimientos?variante=${r.variant_id}`}>
        Ver movimientos
      </DropdownItem>
      <DropdownItem icon={<Pencil />} href={`/admin/productos/${r.product_id}`}>
        Editar producto
      </DropdownItem>
    </DropdownMenu>
  );

  const subtitleOf = (r: AdminInventoryRow) =>
    `${r.variant_title !== "Default" ? r.variant_title : "Variante única"}${!r.is_active ? " · Inactiva" : ""}${
      r.product_status !== "active" ? ` · ${r.product_status === "draft" ? "Borrador" : "Archivado"}` : ""
    }`;

  const toolbarClass = "flex w-full flex-wrap items-center gap-2 rounded-adm border border-adm-border bg-adm-surface-2 px-2 py-1 max-md:py-2";
  const bulkButtons = (
    <>
      <span className="tnum px-1 text-[13px] font-medium" aria-live="polite">
        {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
      </span>
      <span aria-hidden className="h-4 w-px bg-adm-border" />
      <Button size="sm" variant="ghost" icon={<SlidersHorizontal />} className="max-md:h-10" onClick={() => setAdjust({ kind: "bulk", variantIds: [...selected] })}>
        Ajustar stock
      </Button>
      <span className="flex-1" />
      <Button size="sm" variant="ghost" className="max-md:h-10" onClick={() => setSelected(new Set())}>
        Deseleccionar
      </Button>
    </>
  );

  return (
    <>
      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-2">
        {someSelected ? (
          <div role="toolbar" aria-label="Acciones sobre las variantes seleccionadas" className={cn(toolbarClass, "hidden md:flex")}>
            {bulkButtons}
          </div>
        ) : null}
        {/* Filtros: siempre en celular; en escritorio los reemplaza la barra de acciones. */}
        <>
            <div className={cn("flex w-full gap-2 sm:w-auto", someSelected && "md:hidden")}>
              <SearchInput placeholder="Buscar por producto, variante o SKU" className="min-w-0 flex-1 sm:w-[280px] sm:flex-none" />
              <Button
                className="md:hidden"
                icon={<ListFilter />}
                aria-expanded={filtersOpen}
                aria-controls="inventory-filters"
                onClick={() => setFiltersOpen((o) => !o)}
              >
                Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </Button>
            </div>
            <div id="inventory-filters" className={cn(filtersOpen ? "flex" : "hidden", "w-full flex-wrap items-center gap-2", someSelected ? "md:hidden" : "md:contents")}>
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
            </div>
        </>
      </div>

      {/* Mobile: tarjetas con el stock editable en un toque. */}
      <div className="relative rounded-adm border border-adm-border bg-adm-surface shadow-adm-card md:hidden">
        {items.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-[15px] font-semibold text-adm-fg">{emptyTitle}</p>
            <p className="mt-1 text-[13px] text-adm-fg-muted">{emptyDescription}</p>
            {hasFilters ? (
              <div className="mt-3">
                <Button size="sm" onClick={() => clear()}>
                  Limpiar filtros
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <ul>
            {items.map((r) => (
              <li
                key={r.variant_id}
                className={cn("flex items-start border-b border-adm-border last:border-b-0", selected.has(r.variant_id) && "bg-adm-accent-2-soft/60")}
              >
                <label className="flex h-14 w-12 shrink-0 cursor-pointer items-center justify-center">
                  <Checkbox aria-label={`Seleccionar ${labelOf(r)}`} checked={selected.has(r.variant_id)} onChange={() => toggle(r.variant_id)} />
                </label>
                <div className="min-w-0 flex-1 py-2">
                  <Link href={`/admin/productos/${r.product_id}`} className="flex min-h-11 items-center gap-3 pr-1">
                    <Thumb url={r.image_url} size={44} />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-medium text-adm-fg">{r.product_name}</span>
                      <span className="mt-0.5 block truncate text-xs text-adm-fg-muted">
                        {subtitleOf(r)}
                        {r.sku ? <span className="font-mono"> · {r.sku}</span> : null}
                      </span>
                    </span>
                  </Link>
                  <div className="mt-2 flex items-center gap-2">
                    {r.track_inventory ? (
                      <div className="min-w-0 flex-1">
                        <InlineNumber
                          chip="Stock"
                          label={`Stock de ${labelOf(r)}`}
                          value={r.stock}
                          display={formatNumber(r.stock)}
                          onSave={(v) => saveStock(r, v)}
                        />
                      </div>
                    ) : (
                      <div className="flex h-11 min-w-0 flex-1 items-center rounded-adm bg-adm-surface-2 px-3 text-sm text-adm-fg-muted">Sin control de stock</div>
                    )}
                    <StockStateBadge state={r.stock_state} />
                  </div>
                </div>
                <div className="flex h-14 w-12 shrink-0 items-center justify-center">{menuFor(r)}</div>
              </li>
            ))}
          </ul>
        )}
        <PendingOverlay />
      </div>

      <Table containerClassName="hidden max-h-[calc(100dvh-19rem)] min-h-40 md:block">
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
            <TH>SKU</TH>
            <TH numeric>Stock</TH>
            <TH numeric>Umbral</TH>
            <TH>Estado</TH>
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
              title={emptyTitle}
              description={emptyDescription}
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
                      <p className="truncate text-xs text-adm-fg-muted">{subtitleOf(r)}</p>
                    </div>
                  </div>
                </TD>
                <TD className="font-mono text-xs" muted>
                  {r.sku ?? "—"}
                </TD>
                <TD numeric>
                  {r.track_inventory ? (
                    <span
                      className={cn(
                        "inline-flex font-medium",
                        r.stock_state === "out" && "text-adm-danger",
                        r.stock_state === "low" && "text-adm-warning",
                      )}
                    >
                      <InlineNumber
                        label={`Stock de ${labelOf(r)}`}
                        value={r.stock}
                        display={formatNumber(r.stock)}
                        onSave={(v) => saveStock(r, v)}
                      />
                    </span>
                  ) : (
                    <span className="text-adm-fg-muted">—</span>
                  )}
                </TD>
                <TD numeric muted>
                  {r.track_inventory ? (
                    <span title={r.low_stock_threshold === null ? "Umbral general de la tienda" : "Umbral propio de la variante"}>
                      {formatNumber(r.threshold)}
                      {r.low_stock_threshold === null ? <span className="ml-0.5 text-[11px]">*</span> : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>
                  <StockStateBadge state={r.stock_state} />
                </TD>
                <TD className="hidden whitespace-nowrap lg:table-cell" muted>
                  <time suppressHydrationWarning dateTime={r.updated_at} title={formatDateTime(r.updated_at)}>
                    {formatRelative(r.updated_at)}
                  </time>
                </TD>
                <TD className="w-10 pl-0 text-right">{menuFor(r)}</TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-adm-fg-muted">
            Tocá el stock para escribir la cantidad que hay ahora; queda en Movimientos y se puede deshacer. * Usa el umbral general de la tienda.
          </p>
          <Pagination page={page} perPage={perPage} total={total} className="flex-1 sm:flex-none" />
        </div>
      ) : null}

      {someSelected ? (
        <div
          data-adm-bottom-bar=""
          role="toolbar"
          aria-label="Acciones sobre las variantes seleccionadas"
          className="sticky bottom-0 z-20 -mx-4 mt-3 flex flex-wrap items-center gap-2 border-t border-adm-border bg-adm-surface px-3 py-2 shadow-[var(--adm-shadow)] md:hidden"
        >
          {bulkButtons}
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
