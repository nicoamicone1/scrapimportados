"use client";

import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Eye,
  ExternalLink,
  FileEdit,
  FolderMinus,
  FolderPlus,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { useAdminStore } from "@/components/admin/AdminStoreContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Checkbox, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatMoney, formatNumber, parseMoney } from "@/lib/money";
import type { ProductListItem } from "@/lib/admin/products";
import type { BulkProductAction } from "@/lib/schemas/product";

import { bulkProducts, inlineUpdateVariant } from "@/app/admin/(panel)/productos/actions";

import { DeleteProductDialog, DuplicateProductDialog } from "./ProductDialogs";
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
  const { clear } = useUrlFilters();
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

  const runBulk = (action: BulkProductAction, targetIds: string[], categoryId?: string, silent = false) =>
    new Promise<boolean>((resolve) => {
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
          if (action === "archive") {
            toast.success(messages[action], {
              duration: 6000,
              action: {
                label: "Deshacer",
                onClick: () => {
                  // Vuelve cada producto a su estado anterior.
                  const prev = new Map(items.map((i) => [i.id, i.status]));
                  const active = targetIds.filter((id) => prev.get(id) === "active");
                  const rest = targetIds.filter((id) => prev.get(id) !== "active");
                  void (async () => {
                    if (active.length) await runBulk("publish", active, undefined, true);
                    if (rest.length) await runBulk("restore", rest, undefined, true);
                    toast.success("Listo, se deshizo el archivado");
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

  const selectedIds = [...selected];
  const colSpan = 8;

  return (
    <>
      {/* Barra de filtros o de acciones masivas */}
      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-2">
        {someSelected ? (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-adm border border-adm-border bg-adm-surface-2 px-2 py-1">
            <span className="tnum px-1 text-[13px] font-medium">
              {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
            </span>
            <span aria-hidden className="h-4 w-px bg-adm-border" />
            <Button size="sm" variant="ghost" icon={<Send />} disabled={bulkPending} onClick={() => runBulk("publish", selectedIds)}>
              Publicar
            </Button>
            <Button size="sm" variant="ghost" icon={<FileEdit />} disabled={bulkPending} onClick={() => runBulk("draft", selectedIds)}>
              Pasar a borrador
            </Button>
            <Button size="sm" variant="ghost" icon={<Archive />} disabled={bulkPending} onClick={() => runBulk("archive", selectedIds)}>
              Archivar
            </Button>
            <Button size="sm" variant="ghost" icon={<FolderPlus />} disabled={bulkPending} onClick={() => setCategoryDialog("add_category")}>
              Asignar categoría
            </Button>
            <Button size="sm" variant="ghost" icon={<FolderMinus />} disabled={bulkPending} onClick={() => setCategoryDialog("remove_category")}>
              Quitar categoría
            </Button>
            <span className="flex-1" />
            {bulkPending ? <Loader2 className="size-4 animate-spin text-adm-fg-muted" aria-label="Aplicando" /> : null}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Deseleccionar
            </Button>
          </div>
        ) : (
          <>
            <SearchInput placeholder="Buscar por nombre, SKU o marca" className="sm:w-[280px]" />
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
          </>
        )}
      </div>

      <Table containerClassName="max-h-[calc(100dvh-15rem)] min-h-40" pending={bulkPending || undefined}>
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
            <TH className="hidden md:table-cell">Estado</TH>
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
            <TableEmpty
              colSpan={colSpan}
              title={hasFilters ? "No hay productos con estos filtros." : "Todavía no hay productos acá."}
              description={hasFilters ? "Probá con otra búsqueda o sacá algún filtro." : undefined}
              action={
                hasFilters ? (
                  <Button size="sm" onClick={() => clear()}>
                    Limpiar filtros
                  </Button>
                ) : (
                  <ButtonLink size="sm" variant="primary" href="/admin/productos/nuevo">
                    Nuevo producto
                  </ButtonLink>
                )
              }
            />
          ) : (
            items.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                selected={selected.has(p.id)}
                onToggle={() => toggle(p.id)}
                categoryNames={p.category_ids.map((id) => catName.get(id)).filter((n): n is string => Boolean(n))}
                onDuplicate={() => setDuplicate({ id: p.id, name: p.name })}
                onDelete={() => setToDelete({ id: p.id, name: p.name })}
                onStatus={(action) => runBulk(action, [p.id])}
              />
            ))
          )}
        </TBody>
      </Table>
      {total > 0 ? <Pagination page={page} perPage={perPage} total={total} /> : null}

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

function ProductRow({
  product: p,
  selected,
  onToggle,
  categoryNames,
  onDuplicate,
  onDelete,
  onStatus,
}: {
  product: ProductListItem;
  selected: boolean;
  onToggle: () => void;
  categoryNames: string[];
  onDuplicate: () => void;
  onDelete: () => void;
  onStatus: (action: BulkProductAction) => void;
}) {
  // Copia local para reflejar la edición inline; se resincroniza si el server manda otro valor.
  const router = useRouter();
  const [single, setSingle] = useState(p.single);
  const [serverSingle, setServerSingle] = useState(p.single);
  if (p.single !== serverSingle) {
    setServerSingle(p.single);
    setSingle(p.single);
  }

  const { store } = useAdminStore();
  const productPath = `/producto/${p.slug}`;
  const storeUrl = `${store.href}${productPath}`;
  const previewUrl = `${storeUrl}?preview=1`;
  const price =
    p.min_price === null
      ? "—"
      : p.max_price !== null && p.max_price !== p.min_price
        ? `${formatMoney(p.min_price)} – ${formatMoney(p.max_price)}`
        : formatMoney(p.min_price);
  const firstSku = p.skus.trim().split(/\s+/)[0];

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
              <span className="md:hidden"> · {p.status === "active" ? "Activo" : p.status === "draft" ? "Borrador" : "Archivado"}</span>
            </p>
          </div>
        </div>
      </TD>
      <TD className="hidden md:table-cell">
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
          price
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
        <DropdownMenu
          width={224}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${p.name}`}>
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
      </TD>
    </TR>
  );
}

/**
 * Número editable en la celda: click → input; Enter o salir del campo guarda,
 * Esc cancela. Muestra spinner y un check al guardar.
 */
function InlineNumber({
  label,
  value,
  display,
  money,
  onSave,
}: {
  label: string;
  value: number;
  display: string;
  money?: boolean;
  onSave: (value: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const start = () => {
    cancelled.current = false;
    setText(money ? String(value).replace(".", ",") : String(value));
    setEditing(true);
  };

  const commit = async () => {
    if (cancelled.current) return;
    const parsed = money ? parseMoney(text) : Number.parseInt(text, 10);
    setEditing(false);
    if (!Number.isFinite(parsed) || text.trim() === "") {
      toast.error(money ? "Ingresá un precio válido." : "Ingresá un número entero.");
      return;
    }
    if (parsed === value) return;
    setState("saving");
    const okSave = await onSave(parsed);
    setState(okSave ? "saved" : "error");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelled.current = true;
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={label}
        inputMode={money ? "decimal" : "numeric"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void commit()}
        className="tnum h-7 w-24 rounded-adm border border-adm-accent bg-adm-surface px-2 text-right text-[13px] outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      title="Click para editar"
      aria-label={`${label}: ${display}. Editar`}
      className={cn(
        "tnum -mr-1.5 inline-flex h-7 items-center gap-1 rounded-adm px-1.5 hover:bg-adm-surface-2 hover:ring-1 hover:ring-adm-input-border",
        state === "error" && "text-adm-danger",
      )}
    >
      {state === "saving" ? <Loader2 className="size-3.5 animate-spin text-adm-fg-muted" aria-hidden /> : null}
      {state === "saved" ? <Check className="size-3.5 text-adm-success" aria-hidden /> : null}
      {display}
    </button>
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
