"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EyeOff, FolderPlus, GripVertical, MoreHorizontal, Pencil, Plus, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAdminStore } from "@/components/admin/AdminStoreContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/cn";
import {
  applyDrop,
  descendantsOf,
  flattenTree,
  MAX_CATEGORY_DEPTH,
  projectDepth,
  toReorderItems,
  type FlatCategory,
} from "@/lib/admin/category-tree";
import type { AdminCategory } from "@/lib/admin/categories";
import { formatNumber } from "@/lib/money";

import { deleteCategory, reorderCategories } from "@/app/admin/(panel)/categorias/actions";

import { CategoryDrawer, type CategoryDrawerTarget } from "./CategoryDrawer";

const INDENT = 24;

export function CategoriesManager({ categories: initial }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initial);
  const [serverCategories, setServerCategories] = useState(initial);
  if (initial !== serverCategories) {
    setServerCategories(initial);
    setCategories(initial);
  }
  const [drawer, setDrawer] = useState<CategoryDrawerTarget | null>(null);
  const [toDelete, setToDelete] = useState<AdminCategory | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [saving, setSaving] = useState(false);

  const flat = useMemo(() => flattenTree(categories), [categories]);
  const childrenCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of categories) if (c.parent_id) m.set(c.parent_id, (m.get(c.parent_id) ?? 0) + 1);
    return m;
  }, [categories]);

  // Mientras se arrastra, las hijas de la activa se ocultan (viajan con ella).
  const hidden = useMemo(() => (activeId ? descendantsOf(categories, activeId) : new Set<string>()), [activeId, categories]);
  const visible = flat.filter((f) => !hidden.has(f.id));
  const activeItem = activeId ? flat.find((f) => f.id === activeId) : undefined;

  const subtreeHeight = useMemo(() => {
    if (!activeItem) return 0;
    let h = 0;
    for (const f of flat) if (hidden.has(f.id)) h = Math.max(h, f.depth - activeItem.depth);
    return h;
  }, [activeItem, flat, hidden]);

  /** Profundidad y madre resultantes de soltar `activeId` sobre `targetId` con un desplazamiento horizontal `dx`. */
  const project = (active: string | null, target: string | null, dx: number) => {
    const item = active ? flat.find((f) => f.id === active) : undefined;
    if (!active || !target || !item) return null;
    const from = visible.findIndex((f) => f.id === active);
    const to = visible.findIndex((f) => f.id === target);
    if (from === -1 || to === -1) return null;
    const moved = arrayMove(visible, from, to);
    const desired = item.depth + Math.round(dx / INDENT);
    // `visible` no incluye las hijas de la activa: su altura se descuenta del máximo.
    return projectDepth(moved, to, desired, MAX_CATEGORY_DEPTH - 1 - subtreeHeight, false);
  };
  const projected = project(activeId, overId, offsetX);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const resetDrag = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  };

  const onDragEnd = async ({ active, over, delta }: DragEndEvent) => {
    // Se calcula con los datos del evento (el estado del último render puede estar atrasado).
    const proj = over ? project(String(active.id), String(over.id), delta.x) : null;
    resetDrag();
    if (!over || !proj) return;
    const next = applyDrop(flat, String(active.id), String(over.id), proj.depth);
    const items = toReorderItems(next);
    const before = categories;
    const byId = new Map(items.map((i) => [i.id, i]));
    const optimistic = categories.map((c) => {
      const it = byId.get(c.id);
      return it ? { ...c, parent_id: it.parent_id, position: it.position } : c;
    });
    const changed = optimistic.filter((c, i) => c.parent_id !== before[i].parent_id || c.position !== before[i].position);
    if (!changed.length) return;
    setCategories(optimistic);
    setSaving(true);
    const res = await reorderCategories(
      changed.map((c) => ({ id: c.id, parent_id: c.parent_id, position: c.position })),
    );
    setSaving(false);
    if (!res.ok) {
      setCategories(before);
      toast.error(res.error);
      return;
    }
    toast.success("Orden guardado");
    router.refresh();
  };

  const openNew = (parentId: string | null = null) => setDrawer({ mode: "new", parentId });
  const openEdit = (c: AdminCategory) => setDrawer({ mode: "edit", category: c });

  const header = (
    <PageHeader
      title="Categorías"
      description={
        categories.length
          ? `${formatNumber(categories.length)} categorías · Arrastrá para ordenar; movelas a la derecha para anidarlas.`
          : "Organizá el catálogo para que se navegue fácil."
      }
      actions={
        <Button variant="primary" icon={<Plus />} onClick={() => openNew()}>
          Nueva categoría
        </Button>
      }
    />
  );

  return (
    <>
      {header}
      {categories.length === 0 ? (
        <EmptyState
          title="Todavía no hay categorías"
          description="Creá categorías como «Remeras» o «Auriculares» y asignales productos. Se pueden anidar hasta 3 niveles."
          actions={
            <Button variant="primary" onClick={() => openNew()}>
              Nueva categoría
            </Button>
          }
        />
      ) : (
        <div className="rounded-adm border border-adm-border bg-adm-surface">
          <div className="flex h-9 items-center gap-3 border-b border-adm-border bg-adm-surface-2 px-3 text-xs font-medium text-adm-fg-muted">
            <span className="w-7" />
            <span className="flex-1">Nombre</span>
            <span className="hidden w-24 text-right sm:block">Productos</span>
            <span className="w-8" />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={({ active }: DragStartEvent) => {
              setActiveId(String(active.id));
              setOverId(String(active.id));
            }}
            onDragMove={({ delta }: DragMoveEvent) => setOffsetX(delta.x)}
            onDragOver={({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null)}
            onDragEnd={(e) => void onDragEnd(e)}
            onDragCancel={resetDrag}
          >
            <SortableContext items={visible.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <ul aria-label="Árbol de categorías" aria-busy={saving || undefined}>
                {visible.map((f) => (
                  <CategoryRow
                    key={f.id}
                    flat={f}
                    depth={f.id === activeId && projected ? projected.depth : f.depth}
                    childCount={childrenCount.get(f.id) ?? 0}
                    ghost={f.id === activeId}
                    onEdit={() => openEdit(f.item)}
                    onAddChild={() => openNew(f.id)}
                    onDelete={() => setToDelete(f.item)}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeItem ? (
                <div className="flex h-10 items-center gap-2 rounded-adm border border-adm-border bg-adm-surface px-3 text-[13px] font-medium shadow-[var(--adm-shadow)]">
                  <GripVertical className="size-4 text-adm-fg-muted" aria-hidden />
                  {activeItem.item.name}
                  {hidden.size ? <span className="text-xs font-normal text-adm-fg-muted">+{hidden.size} subcategorías</span> : null}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      <CategoryDrawer target={drawer} categories={categories} onOpenChange={(o) => !o && setDrawer(null)} onDelete={(c) => setToDelete(c)} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title="Borrar categoría"
        description={
          toDelete
            ? (childrenCount.get(toDelete.id) ?? 0) > 0
              ? `«${toDelete.name}» tiene subcategorías. Movelas o borralas primero.`
              : toDelete.product_count
                ? `«${toDelete.name}» tiene ${formatNumber(toDelete.product_count)} producto${toDelete.product_count === 1 ? "" : "s"}. Van a quedar sin esta categoría (no se borran).`
                : `Se borra «${toDelete.name}». No tiene productos.`
            : undefined
        }
        confirmLabel="Borrar categoría"
        onConfirm={async () => {
          if (!toDelete) return;
          if ((childrenCount.get(toDelete.id) ?? 0) > 0) {
            toast.error("Tiene subcategorías. Movelas o borralas primero.");
            return;
          }
          const res = await deleteCategory(toDelete.id);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          setCategories((cs) => cs.filter((c) => c.id !== toDelete.id));
          setDrawer(null);
          toast.success("Categoría borrada");
        }}
      />
    </>
  );
}

function CategoryRow({
  flat,
  depth,
  childCount,
  ghost,
  onEdit,
  onAddChild,
  onDelete,
}: {
  flat: FlatCategory<AdminCategory>;
  depth: number;
  childCount: number;
  ghost: boolean;
  onEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
}) {
  const c = flat.item;
  const { store } = useAdminStore();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: flat.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row flex h-10 items-center gap-3 border-b border-adm-border px-3 text-[13px] last:border-b-0 hover:bg-adm-hover",
        ghost && "bg-adm-surface-2 opacity-60",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${c.name}. Arrastrá hacia la derecha para anidar.`}
        className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: depth * INDENT }}>
        {depth > 0 ? <span aria-hidden className="h-px w-3 shrink-0 bg-adm-input-border" /> : null}
        <button type="button" onClick={onEdit} className="truncate font-medium text-adm-fg hover:underline">
          {c.name}
        </button>
        <span className="hidden truncate font-mono text-xs text-adm-fg-muted md:inline">/{c.slug}</span>
        {!c.is_visible ? (
          <Badge tone="neutral">
            <EyeOff className="size-3" aria-hidden /> Oculta
          </Badge>
        ) : null}
        {childCount ? <span className="text-xs text-adm-fg-muted">{childCount} sub</span> : null}
      </div>
      <Link
        href={`/admin/productos?categoria=${c.id}`}
        className="tnum hidden w-24 text-right text-adm-fg-muted hover:text-adm-fg hover:underline sm:block"
        title="Ver productos de esta categoría"
      >
        {formatNumber(c.product_count)}
      </Link>
      <DropdownMenu
        width={220}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${c.name}`}>
            <MoreHorizontal />
          </Button>
        }
      >
        <DropdownItem icon={<Pencil />} onSelect={onEdit}>
          Editar
        </DropdownItem>
        <DropdownItem icon={<FolderPlus />} onSelect={onAddChild} disabled={depth >= MAX_CATEGORY_DEPTH - 1}>
          Agregar subcategoría
        </DropdownItem>
        <DropdownItem icon={<ExternalLink />} onSelect={() => window.open(`${store.href}/categoria/${c.slug}`, "_blank", "noopener")}>
          Ver en la tienda
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem icon={<Trash2 />} danger onSelect={onDelete}>
          Borrar
        </DropdownItem>
      </DropdownMenu>
    </li>
  );
}
