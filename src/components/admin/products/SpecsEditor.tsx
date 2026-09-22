"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ClipboardPaste, Copy, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { MAX_SPECS, parseSpecsText } from "@/lib/admin/specs";
import { MAX_RELATED } from "@/lib/schemas/product";
import type { ProductSummary } from "@/lib/admin/products";

import { getProductSpecs } from "@/app/admin/(panel)/productos/actions";

import { newKey, type FormSpec } from "./form-state";
import { ProductPicker } from "./ProductPicker";
import { Thumb } from "./Thumb";

const rowInput =
  "h-8 w-full min-w-0 rounded-adm border border-adm-input-border bg-adm-surface px-2 text-[13px] text-adm-fg placeholder:text-adm-fg-muted/60 hover:border-[#bdb7ab] aria-invalid:border-adm-danger";

function useListSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function DragHandle({ label, listeners, attributes }: { label: string; listeners: object | undefined; attributes: object }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...attributes}
      {...listeners}
      className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Ficha técnica
// ---------------------------------------------------------------------------

export function SpecsEditor({
  value,
  onChange,
  productId,
  errors,
}: {
  value: FormSpec[];
  onChange: (next: FormSpec[]) => void;
  productId: string | null;
  errors: Record<string, string[] | undefined>;
}) {
  const sensors = useListSensors();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const append = (rows: { label: string; value: string }[]) => {
    const existing = new Map(value.map((r) => [r.label.trim().toLowerCase(), r]));
    const next = [...value];
    for (const r of rows) {
      const key = r.label.trim().toLowerCase();
      const found = existing.get(key);
      if (found) {
        const idx = next.findIndex((x) => x.key === found.key);
        if (idx >= 0 && !next[idx].value.trim()) next[idx] = { ...next[idx], value: r.value };
        continue;
      }
      if (next.length >= MAX_SPECS) break;
      next.push({ key: newKey("s"), label: r.label, value: r.value });
    }
    onChange(next);
  };

  const update = (key: string, patch: Partial<FormSpec>) => onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = value.findIndex((r) => r.key === active.id);
    const to = value.findIndex((r) => r.key === over.id);
    onChange(arrayMove(value, from, to));
  };

  return (
    <div className="space-y-3">
      {value.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.map((r) => r.key)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5" aria-label="Filas de la ficha técnica">
              <li className="hidden grid-cols-[32px_minmax(0,2fr)_minmax(0,3fr)_32px] gap-2 text-xs text-adm-fg-muted sm:grid">
                <span />
                <span>Característica</span>
                <span>Valor</span>
                <span />
              </li>
              {value.map((row, i) => (
                <SpecRowItem
                  key={row.key}
                  row={row}
                  index={i}
                  error={errors[`specs.${i}.label`]?.[0] ?? errors[`specs.${i}.value`]?.[0]}
                  onChange={(patch) => update(row.key, patch)}
                  onRemove={() => onChange(value.filter((r) => r.key !== row.key))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-[13px] text-adm-fg-muted">
          Datos clave en formato tabla: material, medidas, garantía, origen. Se muestran en la ficha y ayudan a Google.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          icon={<Plus />}
          disabled={value.length >= MAX_SPECS}
          onClick={() => onChange([...value, { key: newKey("s"), label: "", value: "" }])}
        >
          Agregar fila
        </Button>
        <Button size="sm" variant="ghost" icon={<ClipboardPaste />} onClick={() => setPasteOpen(true)}>
          Pegar desde texto
        </Button>
        <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => setPickerOpen(true)}>
          Copiar de otro producto
        </Button>
      </div>

      <Dialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        title="Pegar ficha técnica"
        description="Una característica por línea: «Material: Algodón». También sirve copiar dos columnas de una planilla."
        footer={
          <>
            <Button onClick={() => setPasteOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => {
                const rows = parseSpecsText(pasteText);
                if (!rows.length) {
                  toast.error("No encontramos filas. Usá «Característica: valor», una por línea.");
                  return;
                }
                append(rows);
                toast.success(`${rows.length} fila${rows.length === 1 ? "" : "s"} agregada${rows.length === 1 ? "" : "s"}`);
                setPasteText("");
                setPasteOpen(false);
              }}
            >
              Agregar filas
            </Button>
          </>
        }
      >
        <Field label="Texto" hint={`${parseSpecsText(pasteText).length} filas detectadas.`}>
          <Textarea rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"Material: Algodón\nOrigen: Argentina\nGarantía: 6 meses"} />
        </Field>
      </Dialog>

      <ProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Copiar ficha de otro producto"
        description="Se agregan sus filas a esta ficha (las que ya tenés no se duplican)."
        excludeIds={productId ? [productId] : []}
        onPick={async ([picked]) => {
          if (!picked) return;
          const res = await getProductSpecs(picked.id);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          if (!res.data.specs.length) {
            toast.error(`«${res.data.name}» no tiene ficha técnica.`);
            return;
          }
          append(res.data.specs);
          toast.success(`Ficha copiada de «${res.data.name}»`);
        }}
      />
    </div>
  );
}

function SpecRowItem({
  row,
  index,
  error,
  onChange,
  onRemove,
}: {
  row: FormSpec;
  index: number;
  error?: string;
  onChange: (patch: Partial<FormSpec>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative bg-adm-surface", isDragging && "z-10 shadow-[var(--adm-shadow)]")}
    >
      <div className="grid grid-cols-[32px_minmax(0,1fr)_32px] gap-2 sm:grid-cols-[32px_minmax(0,2fr)_minmax(0,3fr)_32px]">
        <DragHandle label={`Mover fila ${index + 1}`} listeners={listeners} attributes={attributes} />
        <input
          aria-label={`Característica ${index + 1}`}
          className={rowInput}
          value={row.label}
          maxLength={80}
          placeholder="Material"
          aria-invalid={error && !row.label.trim() ? true : undefined}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <input
          aria-label={`Valor ${index + 1}`}
          className={cn(rowInput, "col-start-2 sm:col-start-auto")}
          value={row.value}
          maxLength={500}
          placeholder="Algodón"
          aria-invalid={error && !row.value.trim() ? true : undefined}
          onChange={(e) => onChange({ value: e.target.value })}
        />
        <Button variant="ghost" size="icon" aria-label={`Quitar fila ${index + 1}`} onClick={onRemove} className="row-start-1 col-start-3 sm:col-start-auto sm:row-start-auto">
          <Trash2 />
        </Button>
      </div>
      {error ? <p className="mt-1 pl-10 text-xs text-adm-danger">{error}</p> : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Relacionados
// ---------------------------------------------------------------------------

export function RelatedEditor({
  value,
  onChange,
  productId,
  error,
}: {
  value: ProductSummary[];
  onChange: (next: ProductSummary[]) => void;
  productId: string | null;
  error?: string;
}) {
  const sensors = useListSensors();
  const [open, setOpen] = useState(false);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = value.findIndex((r) => r.id === active.id);
    const to = value.findIndex((r) => r.id === over.id);
    onChange(arrayMove(value, from, to));
  };

  return (
    <div className="space-y-3">
      {value.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-adm-border rounded-adm border border-adm-border" aria-label="Productos relacionados">
              {value.map((p, i) => (
                <RelatedRow key={p.id} product={p} index={i} onRemove={() => onChange(value.filter((r) => r.id !== p.id))} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-[13px] text-adm-fg-muted">
          Si no elegís ninguno, la tienda muestra productos de la misma categoría. Los que elijas acá tienen prioridad.
        </p>
      )}
      {error ? <p className="text-xs text-adm-danger">{error}</p> : null}
      <Button size="sm" icon={<Plus />} disabled={value.length >= MAX_RELATED} onClick={() => setOpen(true)}>
        {value.length >= MAX_RELATED ? `Máximo ${MAX_RELATED}` : "Agregar productos"}
      </Button>
      <ProductPicker
        open={open}
        onOpenChange={setOpen}
        title="Productos relacionados"
        description={`Elegí hasta ${MAX_RELATED - value.length} más.`}
        multiple
        max={MAX_RELATED - value.length}
        excludeIds={[...(productId ? [productId] : []), ...value.map((v) => v.id)]}
        onPick={(items) => onChange([...value, ...items].slice(0, MAX_RELATED))}
      />
    </div>
  );
}

function RelatedRow({ product, index, onRemove }: { product: ProductSummary; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 bg-adm-surface px-1 py-1", isDragging && "z-10 shadow-[var(--adm-shadow)]")}
    >
      <DragHandle label={`Mover ${product.name}`} listeners={listeners} attributes={attributes} />
      <span className="tnum w-4 text-xs text-adm-fg-muted">{index + 1}</span>
      <Thumb url={product.image_url} size={32} />
      <span className="min-w-0 flex-1 truncate text-[13px]">{product.name}</span>
      {product.status !== "active" ? <span className="text-xs text-adm-fg-muted">No publicado</span> : null}
      <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${product.name}`} onClick={onRemove}>
        <X />
      </Button>
    </li>
  );
}
