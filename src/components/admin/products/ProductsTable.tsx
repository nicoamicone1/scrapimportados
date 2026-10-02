"use client";

import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  ExternalLink,
  FileEdit,
  FolderMinus,
  FolderPlus,
  Link2,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useAdminStore } from "@/components/admin/AdminStoreContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Checkbox, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { PendingOverlay } from "@/components/ui/PendingOverlay";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";
import type { ProductListItem } from "@/lib/admin/products";
import type { BulkProductAction } from "@/lib/schemas/product";

import { bulkProducts, inlineUpdateVariant } from "@/app/admin/(panel)/productos/actions";

import { DeleteProductDialog, DuplicateProductDialog } from "./ProductDialogs";
import { InlineNumber } from "./InlineNumber";
import { Thumb } from "./Thumb";
import { UrlSelect, useUrlFilters } from "./url-filters";

export interface CategoryLabel {
  id: string;
  name: string;
  path: string;
}

interface Props {
  items: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
  categories: CategoryLabel[];
  hasFilters: boolean;
}

export function ProductsTable({ items, total, page, perPage, categories, hasFilters }: Props) {
  const router = useRouter();
  const { clear, get } = useUrlFilters();
  // La tabla se remonta al cambiar un filtro: si hay alguno activo, el panel sigue abierto.
  const [filtersOpen, setFiltersOpen] = useState(() => ["categoria", "stock", "origen", "orden"].some((k) => get(k)));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const [categoryDialog, setCategoryDialog] = useState<"add_category" | "remove_category" | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const ids = items.map((i) => i.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = (action: BulkProductAction, targetIds: string[], categoryId?: string, silent = false) => {
    // Estado de cada producto antes de la acción: es lo que restaura "Deshacer".
    const previous = new Map(items.map((i) => [i.id, i.status]));
    return new Promise<boolean>((resolve) => {
      startBulk(async () => {
        const res = await bulkProducts({ ids: targetIds, action, categoryId });
        if (!res.ok) {
          toast.error(res.error);
          resolve(false);
          return;
        }
        if (!silent) {
          const n = res.data.count;
          const plural = n === 1 ? "" : "s";
          const messages: Record<BulkProductAction, string> = {
            publish: `${n} producto${plural} publicado${plural}`,
            draft: `${n} producto${plural} en borrador`,
            archive: `${n} producto${plural} archivado${plural}`,
            restore: `${n} producto${plural} restaurado${plural}`,
            add_category: `Categoría asignada a ${n} producto${plural}`,
            remove_category: `Categoría quitada de ${n} producto${plural}`,
          };
          const statusAction = action === "publish" || action === "draft" || action === "archive" || action === "restore";
          if (statusAction) {
            toast.success(messages[action], {
              duration: 8000,
              action: {
                label: "Deshacer",
                onClick: () => {
                  // Cada producto vuelve a su estado anterior.
                  const byStatus = { active: [] as string[], draft: [] as string[], archived: [] as string[] };
                  for (const id of targetIds) {
                    const st = previous.get(id);
                    if (st === "active" || st === "draft" || st === "archived") byStatus[st].push(id);
                  }
                  void (async () => {
                    if (byStatus.active.length) await runBulk("publish", byStatus.active, undefined, true);
                    if (byStatus.draft.length) await runBulk("draft", byStatus.draft, undefined, true);
                    if (byStatus.archived.length) await runBulk("archive", byStatus.archived, undefined, true);
                    toast.success("Listo, se deshizo el cambio");
                  })();
                },
              },
            });
          } else toast.success(messages[action]);
        }
        setSelected(new Set());
        router.refresh();
        resolve(true);
      });
    });
  };

  const selectedIds = [...selected];
  const colSpan = 8;
  const activeFilterCount = ["categoria", "stock", "origen", "orden"].filter((k) => get(k)).length;
  const emptyTitle = hasFilters ? "No hay productos con estos filtros." : "Todavía no hay productos acá.";
  const emptyDescription = hasFilters ? "Probá con otra búsqueda o sacá algún filtro." : undefined;
  const emptyAction = hasFilters ? (
    <Button size="sm" onClick={() => clear()}>
      Limpiar filtros
    </Button>
  ) : (
    <ButtonLink size="sm" variant="primary" href="/admin/productos/nuevo">
      Nuevo producto
    </ButtonLink>
  );
  const rowProps = (p: ProductListItem) => ({
    product: p,
    selected: selected.has(p.id),
    onToggle: () => toggle(p.id),
    onDuplicate: () => setDuplicate({ id: p.id, name: p.name }),
    onDelete: () => setToDelete({ id: p.id, name: p.name }),
    onStatus: (action: BulkProductAction) => void runBulk(action, [p.id]),
  });

  const bulkButtons = (
    <>
      <span className="tnum px-1 text-[13px] font-medium" aria-live="polite">
        {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
      </span>
      <span aria-hidden className="h-4 w-px bg-adm-border" />
      <Button size="sm" variant="ghost" icon={<Send />} disabled={bulkPending} onClick={() => runBulk("publish", selectedIds)} className="max-md:h-10">
        Publicar
      </Button>
      <Button size="sm" variant="ghost" icon={<FileEdit />} disabled={bulkPending} onClick={() => runBulk("draft", selectedIds)} className="max-md:h-10">
        Pasar a borrador
      </Button>
      <Button size="sm" variant="ghost" icon={<Archive />} disabled={bulkPending} onClick={() => runBulk("archive", selectedIds)} className="max-md:h-10">
        Archivar
      </Button>
      <DropdownMenu
        width={224}
        align="start"
        trigger={
          <Button size="sm" variant="ghost" icon={<FolderPlus />} disabled={bulkPending} className="max-md:h-10">
            Categoría
          </Button>
        }
      >
        <DropdownItem icon={<FolderPlus />} onSelect={() => setCategoryDialog("add_category")}>
          Asignar categoría…
        </DropdownItem>
        <DropdownItem icon={<FolderMinus />} onSelect={() => setCategoryDialog("remove_category")}>
          Quitar categoría…
        </DropdownItem>
      </DropdownMenu>
      {/* Atajo a la tarea más frecuente después de seleccionar: tocar precios. */}
      <ButtonLink
        size="sm"
        variant="ghost"
        icon={<Tags />}
        href={`/admin/precios?productos=${selectedIds.join(",")}`}
        className="max-md:h-10"
      >
        Cambiar precios
      </ButtonLink>
      <span className="flex-1" />
      {bulkPending ? <Loader2 className="size-4 animate-spin text-adm-fg-muted" aria-label="Aplicando" /> : null}
      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="max-md:h-10">
        Deseleccionar
      </Button>
    </>
  );
  const toolbarClass = "flex w-full flex-wrap items-center gap-1.5 rounded-adm border border-adm-border bg-adm-surface-2 px-2 py-1 max-md:py-2";

  return (
    <>
      {/* Barra de filtros o de acciones masivas */}
      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-2">
        {someSelected ? (
          <div role="toolbar" aria-label="Acciones sobre los productos seleccionados" className={cn(toolbarClass, "hidden md:flex")}>
            {bulkButtons}
          </div>
        ) : null}
        {/* Filtros: siempre en celular; en escritorio los reemplaza la barra de acciones. */}
        <div className={cn("flex w-full gap-2 sm:w-auto", someSelected && "md:hidden")}>
          <SearchInput placeholder="Buscar por nombre, SKU o marca" className="min-w-0 flex-1 sm:w-[280px] sm:flex-none" />
          <Button
            className="md:hidden"
            icon={<ListFilter />}
            aria-expanded={filtersOpen}
            aria-controls="product-filters"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>
        <div
          id="product-filters"
          className={cn(filtersOpen ? "flex" : "hidden", "w-full flex-wrap items-center gap-2", someSelected ? "md:hidden" : "md:contents")}
        >
          <UrlSelect
            param="categoria"
            label="Categoría"
            placeholder="Todas las categorías"
            options={categories.map((c) => ({ value: c.id, label: c.path }))}
            className="sm:max-w-56"
          />
          <UrlSelect
            param="stock"
            label="Stock"
            placeholder="Cualquier stock"
            options={[
              { value: "con", label: "Con stock" },
              { value: "bajo", label: "Stock bajo" },
              { value: "sin", label: "Sin stock" },
            ]}
          />
          <UrlSelect
            param="origen"
            label="Origen"
            placeholder="Cualquier origen"
            options={[
              { value: "manual", label: "Carga manual" },
              { value: "import", label: "Importados" },
              { value: "scrape", label: "Scraping" },
            ]}
          />
          <UrlSelect
            param="orden"
            label="Ordenar"
            placeholder="Últimos editados"
            options={[
              { value: "nombre", label: "Nombre (A-Z)" },
              { value: "nuevos", label: "Más nuevos" },
              { value: "precio", label: "Precio: menor a mayor" },
              { value: "precio-desc", label: "Precio: mayor a menor" },
              { value: "stock", label: "Stock: menor a mayor" },
              { value: "stock-desc", label: "Stock: mayor a menor" },
            ]}
          />
          {hasFilters ? (
            <Button size="sm" variant="ghost" icon={<X />} onClick={() => clear(["estado"])}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>

      {/* Mobile: lista de tarjetas (la tabla de 8 columnas no entra a 360 px). */}
      <div className="relative rounded-adm border border-adm-border bg-adm-surface shadow-adm-card md:hidden">
        {items.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-[15px] font-semibold text-adm-fg">{emptyTitle}</p>
            {emptyDescription ? <p className="mt-1 text-[13px] text-adm-fg-muted">{emptyDescription}</p> : null}
            <div className="mt-3 flex gap-2">{emptyAction}</div>
          </div>
        ) : (
          <>
            <label className="flex h-11 cursor-pointer items-center gap-3 border-b border-adm-border bg-adm-table-head px-3.5 text-[13px] text-adm-fg-muted">
              <Checkbox
                aria-label="Seleccionar todos los de esta página"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={() => setSelected(allSelected ? new Set() : new Set(ids))}
              />
              Seleccionar los {formatNumber(items.length)} de esta página
            </label>
            <ul>
              {items.map((p) => (
                <ProductMobileItem key={p.id} {...rowProps(p)} />
              ))}
            </ul>
          </>
        )}
        <PendingOverlay pending={bulkPending || undefined} />
      </div>

      <Table containerClassName="hidden max-h-[calc(100dvh-15rem)] min-h-40 md:block" pending={bulkPending || undefined}>
        <THead>
          <tr>
            <TH className="w-10 pr-0">
              <Checkbox
                aria-label="Seleccionar todos"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={() => setSelected(allSelected ? new Set() : new Set(ids))}
              />
            </TH>
            <TH>Producto</TH>
            <TH>Estado</TH>
            <TH className="hidden lg:table-cell">Categorías</TH>
            <TH numeric>Precio</TH>
            <TH numeric>Stock</TH>
            <TH className="hidden xl:table-cell">Actualizado</TH>
            <TH className="w-10">
              <span className="sr-only">Acciones</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <TableEmpty colSpan={colSpan} title={emptyTitle} description={emptyDescription} action={emptyAction} />
          ) : (
            items.map((p) => (
              <ProductRow
                key={p.id}
                {...rowProps(p)}
                categoryNames={p.category_ids.map((id) => catName.get(id)).filter((n): n is string => Boolean(n))}
              />
            ))
          )}
        </TBody>
      </Table>
      {total > 0 ? <Pagination page={page} perPage={perPage} total={total} /> : null}

      {/* Celular: las acciones quedan fijas abajo, al alcance del pulgar, mientras se sigue tildando. */}
      {someSelected ? (
        <div
          data-adm-bottom-bar=""
          role="toolbar"
          aria-label="Acciones sobre los productos seleccionados"
          className="sticky bottom-0 z-20 -mx-4 mt-3 flex flex-wrap items-center gap-1.5 border-t border-adm-border bg-adm-surface px-3 py-2 shadow-[var(--adm-shadow)] md:hidden"
        >
          {bulkButtons}
        </div>
      ) : null}

      <CategoryBulkDialog
        mode={categoryDialog}
        count={selected.size}
        categories={categories}
        pending={bulkPending}
        onOpenChange={(o) => !o && setCategoryDialog(null)}
        onConfirm={async (categoryId) => {
          if (!categoryDialog) return;
          const okRun = await runBulk(categoryDialog, selectedIds, categoryId);
          if (okRun) setCategoryDialog(null);
        }}
      />
      <DuplicateProductDialog product={duplicate} onOpenChange={(o) => !o && setDuplicate(null)} />
      <DeleteProductDialog product={toDelete} onOpenChange={(o) => !o && setToDelete(null)} onDeleted={() => router.refresh()} />
    </>
  );
}

// ---------------------------------------------------------------------------

interface RowProps {
  product: ProductListItem;
  selected: boolean;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStatus: (action: BulkProductAction) => void;
}

/** Variante única editable en línea (precio y stock) + su guardado. */
function useSingleVariant(p: ProductListItem) {
  const router = useRouter();
  // Copia local para reflejar la edición inline; se resincroniza si el server manda otro valor.
  const [single, setSingle] = useState(p.single);
  const [serverSingle, setServerSingle] = useState(p.single);
  if (p.single !== serverSingle) {
    setServerSingle(p.single);
    setSingle(p.single);
  }

  const save = async (patch: { price?: number; stock?: number }) => {
    if (!single) return false;
    const res = await inlineUpdateVariant({
      productId: p.id,
      variantId: single.variantId,
      ...patch,
      ...(patch.stock !== undefined ? { stock_original: single.stock } : {}),
    });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setSingle({ ...single, price: res.data.price, compareAtPrice: res.data.compareAtPrice, stock: res.data.stock });
    router.refresh(); // actualiza el estado de stock (badge) y "Actualizado"
    return true;
  };

  return { single, save };
}

function priceLabel(p: ProductListItem) {
  if (p.min_price === null) return "—";
  return p.max_price !== null && p.max_price !== p.min_price
    ? `${formatMoney(p.min_price)} – ${formatMoney(p.max_price)}`
    : formatMoney(p.min_price);
}

function ProductMenu({ product: p, onDuplicate, onDelete, onStatus }: Omit<RowProps, "selected" | "onToggle">) {
  const { store } = useAdminStore();
  const productPath = `/producto/${p.slug}`;
  const storeUrl = `${store.href}${productPath}`;
  const previewUrl = `${storeUrl}?preview=1`;
  return (
    <DropdownMenu
      width={224}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${p.name}`} className="max-md:size-11">
          <MoreHorizontal />
        </Button>
      }
    >
      <DropdownItem icon={<Pencil />} href={`/admin/productos/${p.id}`}>
        Editar
      </DropdownItem>
      <DropdownItem icon={<Copy />} onSelect={onDuplicate}>
        Duplicar
      </DropdownItem>
      {p.status === "active" ? (
        <DropdownItem icon={<ExternalLink />} onSelect={() => window.open(storeUrl, "_blank", "noopener")}>
          Ver en la tienda
        </DropdownItem>
      ) : (
        <DropdownItem icon={<Eye />} onSelect={() => window.open(previewUrl, "_blank", "noopener")}>
          Vista previa
        </DropdownItem>
      )}
      <DropdownItem
        icon={<Link2 />}
        onSelect={() => {
          void navigator.clipboard
            .writeText(`${store.url}${productPath}`)
            .then(() => toast.success("Link copiado"))
            .catch(() => toast.error("No se pudo copiar el link"));
        }}
      >
        Copiar link
      </DropdownItem>
      <DropdownSeparator />
      {p.status === "archived" ? (
        <>
          <DropdownItem icon={<ArchiveRestore />} onSelect={() => onStatus("restore")}>
            Restaurar como borrador
          </DropdownItem>
          <DropdownItem icon={<Trash2 />} danger onSelect={onDelete}>
            Eliminar definitivamente
          </DropdownItem>
        </>
      ) : (
        <>
          {p.status === "draft" ? (
            <DropdownItem icon={<Send />} onSelect={() => onStatus("publish")}>
              Publicar
            </DropdownItem>
          ) : (
            <DropdownItem icon={<FileEdit />} onSelect={() => onStatus("draft")}>
              Pasar a borrador
            </DropdownItem>
          )}
          <DropdownItem icon={<Archive />} onSelect={() => onStatus("archive")}>
            Archivar
          </DropdownItem>
        </>
      )}
    </DropdownMenu>
  );
}

function ProductRow({
  categoryNames,
  ...rest
}: RowProps & {
  categoryNames: string[];
}) {
  const { product: p, selected, onToggle } = rest;
  const { single, save } = useSingleVariant(p);
  const firstSku = p.skus.trim().split(/\s+/)[0];

  return (
    <TR selected={selected}>
      <TD className="w-10 pr-0">
        <Checkbox aria-label={`Seleccionar ${p.name}`} checked={selected} onChange={onToggle} />
      </TD>
      <TD className="max-w-0 min-w-56 py-1">
        <div className="flex items-center gap-3">
          <Thumb url={p.image_url} />
          <div className="min-w-0">
            <Link
              href={`/admin/productos/${p.id}`}
              className="block truncate font-medium text-adm-fg hover:underline"
              title={p.name}
            >
              {p.name}
            </Link>
            <p className="truncate text-xs text-adm-fg-muted">
              {p.variant_count > 1 ? `${p.variant_count} variantes` : firstSku ? <span className="font-mono">{firstSku}</span> : "Sin SKU"}
              {p.featured ? " · Destacado" : ""}
            </p>
          </div>
        </div>
      </TD>
      <TD>
        <StatusBadge kind="product" value={p.status} />
      </TD>
      <TD className="hidden max-w-48 lg:table-cell" muted>
        <span className="block truncate" title={categoryNames.join(", ")}>
          {categoryNames.length ? categoryNames.slice(0, 2).join(", ") + (categoryNames.length > 2 ? ` +${categoryNames.length - 2}` : "") : "—"}
        </span>
      </TD>
      <TD numeric>
        {single ? (
          <InlineNumber
            label={`Precio de ${p.name}`}
            value={single.price}
            display={formatMoney(single.price)}
            money
            onSave={(v) => save({ price: v })}
          />
        ) : (
          priceLabel(p)
        )}
      </TD>
      <TD numeric>
        <div className="flex items-center justify-end gap-2">
          {p.stock_state === "out" ? <StatusBadge kind="stock" value="out" /> : p.stock_state === "low" ? <StatusBadge kind="stock" value="low" /> : null}
          {single && single.tracked ? (
            <InlineNumber
              label={`Stock de ${p.name}`}
              value={single.stock}
              display={formatNumber(single.stock)}
              onSave={(v) => save({ stock: v })}
            />
          ) : p.tracked ? (
            <span>{formatNumber(p.total_stock)}</span>
          ) : (
            <span className="text-adm-fg-muted" title="No controla stock">
              —
            </span>
          )}
        </div>
      </TD>
      <TD className="hidden whitespace-nowrap xl:table-cell" muted>
        <time suppressHydrationWarning dateTime={p.updated_at} title={formatDateTime(p.updated_at)}>
          {formatRelative(p.updated_at)}
        </time>
      </TD>
      <TD className="w-10 pl-0 text-right">
        <ProductMenu {...rest} />
      </TD>
    </TR>
  );
}

/**
 * Tarjeta de producto para celular: identidad arriba (toca para editar), y
 * debajo precio y stock como botones de 44 px que se editan en el lugar.
 */
function ProductMobileItem(props: RowProps) {
  const { product: p, selected, onToggle } = props;
  const { single, save } = useSingleVariant(p);
  const firstSku = p.skus.trim().split(/\s+/)[0];

  return (
    <li className={cn("flex items-start border-b border-adm-border last:border-b-0", selected && "bg-adm-accent-2-soft/60")}>
      <label className="flex h-14 w-12 shrink-0 cursor-pointer items-center justify-center">
        <Checkbox aria-label={`Seleccionar ${p.name}`} checked={selected} onChange={onToggle} />
      </label>
      <div className="min-w-0 flex-1 py-2">
        <Link href={`/admin/productos/${p.id}`} className="flex min-h-11 items-center gap-3 pr-1">
          <Thumb url={p.image_url} size={44} />
          <span className="min-w-0">
            <span className="line-clamp-2 text-sm font-medium text-adm-fg">{p.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-adm-fg-muted">
              <StatusBadge kind="product" value={p.status} />
              {p.stock_state === "out" ? <StatusBadge kind="stock" value="out" /> : p.stock_state === "low" ? <StatusBadge kind="stock" value="low" /> : null}
              {p.variant_count > 1 ? <span>{p.variant_count} variantes</span> : firstSku ? <span className="font-mono">{firstSku}</span> : null}
            </span>
          </span>
        </Link>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {single ? (
            <InlineNumber
              chip="Precio"
              label={`Precio de ${p.name}`}
              value={single.price}
              display={formatMoney(single.price)}
              money
              onSave={(v) => save({ price: v })}
            />
          ) : (
            <ReadonlyChip label="Precio" value={priceLabel(p)} />
          )}
          {single && single.tracked ? (
            <InlineNumber
              chip="Stock"
              label={`Stock de ${p.name}`}
              value={single.stock}
              display={formatNumber(single.stock)}
              onSave={(v) => save({ stock: v })}
            />
          ) : (
            <ReadonlyChip label="Stock" value={p.tracked ? formatNumber(p.total_stock) : "Sin control"} />
          )}
        </div>
      </div>
      <div className="flex h-14 w-12 shrink-0 items-center justify-center">
        <ProductMenu {...props} />
      </div>
    </li>
  );
}

function ReadonlyChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="tnum flex h-11 items-center justify-between gap-2 rounded-adm bg-adm-surface-2 px-3 text-sm">
      <span className="text-xs text-adm-fg-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CategoryBulkDialog({
  mode,
  count,
  categories,
  pending,
  onOpenChange,
  onConfirm,
}: {
  mode: "add_category" | "remove_category" | null;
  count: number;
  categories: CategoryLabel[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (categoryId: string) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const add = mode === "add_category";
  return (
    <Dialog
      open={mode !== null}
      onOpenChange={onOpenChange}
      title={add ? "Asignar categoría" : "Quitar categoría"}
      description={`${count} producto${count === 1 ? "" : "s"} seleccionado${count === 1 ? "" : "s"}.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!categoryId} loading={pending} onClick={() => onConfirm(categoryId)}>
            {add ? "Asignar" : "Quitar"}
          </Button>
        </>
      }
    >
      <Select
        aria-label="Categoría"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        placeholder="Elegí una categoría"
        options={categories.map((c) => ({ value: c.id, label: c.path }))}
      />
    </Dialog>
  );
}
