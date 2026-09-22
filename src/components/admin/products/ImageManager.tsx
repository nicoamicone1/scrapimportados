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
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Loader2, MoreHorizontal, Star, Trash2, Type } from "lucide-react";
import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { AdminImage } from "@/lib/admin/products";

import { addProductImages, deleteProductImage, reorderProductImages, updateImageAlt } from "@/app/admin/(panel)/productos/actions";

import { IMAGE_ACCEPT, imagesFromClipboard, isAcceptedImage, removeUploaded, uploadImage } from "./image-upload";

/*
 * Imágenes del producto: se suben y guardan al instante (no esperan al
 * "Guardar" del form). Arrastrar para ordenar; la primera es la principal.
 */

interface Props {
  productId: string | null;
  images: AdminImage[];
  onChange: (images: AdminImage[]) => void;
  /** Guarda el borrador si el producto es nuevo y devuelve su id (o null si no se pudo). */
  ensureProductId: () => Promise<string | null>;
  /** Imágenes en uso por variantes (para avisar al borrar). */
  usedByVariants?: Set<string>;
}

export function ImageManager({ productId, images, onChange, ensureProductId, usedByVariants }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [altFor, setAltFor] = useState<AdminImage | null>(null);
  const [toDelete, setToDelete] = useState<AdminImage | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleFiles = async (list: FileList | File[]) => {
    const files = Array.from(list).filter(isAcceptedImage);
    const skipped = Array.from(list).length - files.length;
    if (skipped) toast.error(`${skipped} archivo${skipped === 1 ? "" : "s"} no ${skipped === 1 ? "es una imagen compatible" : "son imágenes compatibles"}.`);
    if (!files.length) return;
    const id = productId ?? (await ensureProductId());
    if (!id) return;

    setUploading((n) => n + files.length);
    const uploaded: Awaited<ReturnType<typeof uploadImage>>[] = [];
    const results = await Promise.allSettled(files.map((f) => uploadImage(f, `products/${id}`)));
    for (const r of results) {
      if (r.status === "fulfilled") uploaded.push(r.value);
      else toast.error(r.reason instanceof Error ? r.reason.message : "No se pudo subir una imagen.");
    }
    if (uploaded.length) {
      const res = await addProductImages({ productId: id, images: uploaded });
      if (res.ok) {
        onChange([...images, ...res.data.images]);
        toast.success(uploaded.length === 1 ? "Imagen subida" : `${uploaded.length} imágenes subidas`);
      } else {
        toast.error(res.error);
        await removeUploaded(uploaded.map((u) => u.path));
      }
    }
    setUploading((n) => n - files.length);
  };

  const persistOrder = async (next: AdminImage[], previous: AdminImage[]) => {
    onChange(next.map((img, position) => ({ ...img, position })));
    if (!productId) return;
    const res = await reorderProductImages(
      productId,
      next.map((i) => i.id),
    );
    if (!res.ok) {
      toast.error(res.error);
      onChange(previous);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = images.findIndex((i) => i.id === active.id);
    const to = images.findIndex((i) => i.id === over.id);
    void persistOrder(arrayMove(images, from, to), images);
  };

  const makeMain = (img: AdminImage) => {
    const next = [img, ...images.filter((i) => i.id !== img.id)];
    void persistOrder(next, images).then(() => toast.success("Imagen principal actualizada"));
  };

  const remove = async (img: AdminImage) => {
    const res = await deleteProductImage(img.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onChange(images.filter((i) => i.id !== img.id));
    toast.success("Imagen borrada");
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const files = imagesFromClipboard(e);
    if (files.length) {
      e.preventDefault();
      void handleFiles(files);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={onDrop}
      onPaste={onPaste}
      className={cn("rounded-adm", dragOver && "ring-2 ring-adm-accent ring-offset-2 ring-offset-adm-surface")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {images.length === 0 && !uploading ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-start gap-1 rounded-adm border border-dashed border-adm-input-border px-4 py-6 text-left hover:bg-adm-hover"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-adm-fg">
            <ImagePlus className="size-4 text-adm-fg-muted" aria-hidden />
            Subir imágenes
          </span>
          <span className="text-[13px] text-adm-fg-muted">
            Arrastralas acá, pegalas con Ctrl+V o elegilas de tu compu. Se optimizan solas (WebP, máx. 1600 px).
            {!productId ? " Al subir la primera se guarda el producto como borrador." : ""}
          </span>
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" aria-label="Imágenes del producto">
              {images.map((img, index) => (
                <SortableImage
                  key={img.id}
                  image={img}
                  index={index}
                  onMain={() => makeMain(img)}
                  onAlt={() => setAltFor(img)}
                  onDelete={() => setToDelete(img)}
                />
              ))}
              {Array.from({ length: uploading }).map((_, i) => (
                <li
                  key={`up-${i}`}
                  className="flex aspect-square items-center justify-center rounded-adm border border-adm-border bg-adm-surface-2"
                >
                  <Loader2 className="size-5 animate-spin text-adm-fg-muted" aria-label="Subiendo" />
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-adm border border-dashed border-adm-input-border text-[13px] text-adm-fg-muted hover:bg-adm-hover hover:text-adm-fg"
                >
                  <ImagePlus className="size-5" aria-hidden />
                  Agregar
                </button>
              </li>
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {images.length > 1 ? (
        <p className="mt-2 text-xs text-adm-fg-muted">Arrastrá para ordenar. La primera es la principal (la que se ve en los listados).</p>
      ) : null}

      <AltDialog
        image={altFor}
        onOpenChange={(o) => !o && setAltFor(null)}
        onSaved={(alt) => {
          if (!altFor) return;
          onChange(images.map((i) => (i.id === altFor.id ? { ...i, alt } : i)));
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title="Borrar imagen"
        description={
          toDelete && usedByVariants?.has(toDelete.id)
            ? "Esta imagen está asignada a variantes: van a quedar sin imagen propia. El archivo se borra del almacenamiento."
            : "Se borra del producto y del almacenamiento. No se puede deshacer."
        }
        confirmLabel="Borrar imagen"
        onConfirm={async () => {
          if (toDelete) await remove(toDelete);
        }}
      />
    </div>
  );
}

function SortableImage({
  image,
  index,
  onMain,
  onAlt,
  onDelete,
}: {
  image: AdminImage;
  index: number;
  onMain: () => void;
  onAlt: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/img relative aspect-square overflow-hidden rounded-adm border border-adm-border bg-adm-surface-2",
        isDragging && "z-10 opacity-80 shadow-[var(--adm-shadow)]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- imágenes del bucket en el admin */}
      <img src={image.url} alt={image.alt ?? ""} className="size-full object-cover" draggable={false} />
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover imagen ${index + 1}`}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      >
        <span className="sr-only">Arrastrá para ordenar</span>
      </button>
      {index === 0 ? (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-[4px] bg-adm-surface px-1.5 py-0.5 text-[11px] font-medium text-adm-fg">
          Principal
        </span>
      ) : null}
      {!image.alt ? (
        <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded-[4px] bg-adm-surface/90 px-1.5 py-0.5 text-[11px] text-adm-fg-muted">
          Sin alt
        </span>
      ) : null}
      <GripVertical
        aria-hidden
        className="pointer-events-none absolute top-1.5 left-1.5 size-4 rounded-[3px] bg-adm-surface/90 text-adm-fg-muted opacity-0 group-hover/img:opacity-100"
      />
      <div className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-focus-within/img:opacity-100 sm:group-hover/img:opacity-100">
        <DropdownMenu
          width={200}
          trigger={
            <Button variant="secondary" size="icon-sm" aria-label={`Opciones de la imagen ${index + 1}`} className="size-6">
              <MoreHorizontal />
            </Button>
          }
        >
          {index > 0 ? (
            <DropdownItem icon={<Star />} onSelect={onMain}>
              Hacer principal
            </DropdownItem>
          ) : null}
          <DropdownItem icon={<Type />} onSelect={onAlt}>
            Texto alternativo
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<Trash2 />} danger onSelect={onDelete}>
            Borrar
          </DropdownItem>
        </DropdownMenu>
      </div>
    </li>
  );
}

function AltDialog({
  image,
  onOpenChange,
  onSaved,
}: {
  image: AdminImage | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (alt: string | null) => void;
}) {
  const [alt, setAlt] = useState("");
  const [pending, setPending] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (image && image.id !== lastId) {
    setLastId(image.id);
    setAlt(image.alt ?? "");
  }

  const save = async () => {
    if (!image) return;
    setPending(true);
    const res = await updateImageAlt(image.id, alt);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onSaved(alt.trim() || null);
    onOpenChange(false);
    setLastId(null);
  };

  return (
    <Dialog
      open={Boolean(image)}
      onOpenChange={(o) => {
        if (!o) setLastId(null);
        onOpenChange(o);
      }}
      title="Texto alternativo"
      description="Describí la foto para quien usa lector de pantalla y para Google."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={pending}>
            Guardar
          </Button>
        </>
      }
    >
      {image ? (
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa */}
          <img src={image.url} alt="" className="size-20 shrink-0 rounded-adm border border-adm-border object-cover" />
          <form
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field label="Descripción de la imagen" hint="Ej.: «Auricular vincha negro plegado, vista lateral».">
              <Input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} autoFocus />
            </Field>
          </form>
        </div>
      ) : null}
    </Dialog>
  );
}
