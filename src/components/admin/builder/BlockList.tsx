"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useId } from "react";
import { Copy, Eye, EyeOff, GripVertical, MonitorOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { BLOCK_META } from "@/lib/blocks/defaults";
import type { Block } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";
import { stripHtml } from "@/lib/html";

import { BLOCK_ICONS } from "./BlockThumb";

/** Resumen corto del contenido del bloque (segunda línea de la lista). */
export function blockSummary(block: Block): string {
  switch (block.type) {
    case "hero":
      return block.settings.title;
    case "product_slider":
    case "product_grid":
      return block.settings.title;
    case "banner_grid":
      return `${block.settings.items.length} ${block.settings.items.length === 1 ? "banner" : "banners"} · ${block.settings.columns} col.`;
    case "rich_text":
      return stripHtml(block.settings.html).slice(0, 60);
    case "heading":
      return block.settings.text;
    case "image_text":
      return block.settings.title;
    case "category_list":
      return block.settings.title ?? (block.settings.categoryIds === "all" ? "Todas las principales" : `${block.settings.categoryIds.length} categorías`);
    case "features":
      return block.settings.items.map((i) => i.title).join(" · ");
    case "faq":
      return block.settings.title ?? `${block.settings.items.length} preguntas`;
    case "countdown":
      return block.settings.title;
    case "testimonials":
      return block.settings.items.length ? `${block.settings.items.length} reseñas` : "Sin reseñas";
    case "video":
      return block.settings.url || "Sin video";
    case "divider":
      return block.settings.style === "line" ? "Línea" : "Espacio";
  }
}

/** Memo: editar un bloque sólo vuelve a renderizar su fila (callbacks estables, reciben el id). */
const Row = memo(function Row({
  block,
  selected,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onDelete,
}: {
  block: Block;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } = useSortable({ id: block.id });
  const Icon = BLOCK_ICONS[block.type];
  const hidden = Boolean(block.style.hidden);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/row relative flex items-center gap-1 rounded-adm border pr-1 text-[13px]",
        selected ? "border-adm-accent bg-adm-accent-soft" : "border-transparent hover:bg-adm-hover",
        isDragging && "z-10 border-adm-border bg-adm-surface shadow-[var(--adm-shadow)]",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Mover ${BLOCK_META[block.type].label}`}
        className="flex h-11 w-6 shrink-0 cursor-grab items-center justify-center text-adm-fg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={() => onSelect(block.id)} aria-current={selected || undefined} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
        <Icon className={cn("size-4 shrink-0", selected ? "text-adm-accent" : "text-adm-fg-muted")} aria-hidden />
        <span className={cn("min-w-0", hidden && "opacity-50")}>
          <span className="block truncate font-medium text-adm-fg">{BLOCK_META[block.type].label}</span>
          <span className="block truncate text-xs text-adm-fg-muted">{blockSummary(block) || "—"}</span>
        </span>
        {block.style.hideOnMobile ? <MonitorOff className="size-3.5 shrink-0 text-adm-fg-muted" aria-label="Oculto en celulares" /> : null}
      </button>
      <div className={cn("flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100", (selected || hidden) && "opacity-100")}>
        <Button size="icon-sm" variant="ghost" aria-label={hidden ? "Mostrar bloque" : "Ocultar bloque"} title={hidden ? "Mostrar" : "Ocultar"} onClick={() => onToggleHidden(block.id)}>
          {hidden ? <EyeOff /> : <Eye />}
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Duplicar bloque" title="Duplicar (Ctrl+D)" onClick={() => onDuplicate(block.id)}>
          <Copy />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Borrar bloque" title="Borrar (Supr)" onClick={() => onDelete(block.id)}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
});

export function BlockList({
  blocks,
  selectedId,
  onSelect,
  onReorder,
  onToggleHidden,
  onDuplicate,
  onDelete,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (blocks: Block[]) => void;
  onToggleHidden: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // id estable: evita el desfasaje de aria-describedby entre server y cliente.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(blocks, from, to));
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: "Para mover un bloque, presioná espacio, usá las flechas y presioná espacio de nuevo para soltarlo." },
      }}
    >
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-0.5" aria-label="Bloques de la página">
          {blocks.map((block) => (
            <Row
              key={block.id}
              block={block}
              selected={block.id === selectedId}
              onSelect={onSelect}
              onToggleHidden={onToggleHidden}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
