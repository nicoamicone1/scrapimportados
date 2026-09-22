"use client";

import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SeoFields } from "@/components/admin/SeoFields";
import { IMAGE_ACCEPT, removeUploaded, uploadImage } from "@/components/admin/products/image-upload";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { categoryPath, descendantsOf, flattenTree, MAX_CATEGORY_DEPTH } from "@/lib/admin/category-tree";
import type { AdminCategory } from "@/lib/admin/categories";

import { saveCategory } from "@/app/admin/(panel)/categorias/actions";

export type CategoryDrawerTarget = { mode: "new"; parentId: string | null } | { mode: "edit"; category: AdminCategory };

interface FormValues {
  name: string;
  slug: string;
  parent_id: string;
  description: string;
  image_url: string | null;
  is_visible: boolean;
  seo: { title: string; description: string };
}

function valuesFor(target: CategoryDrawerTarget | null): FormValues {
  if (target?.mode === "edit") {
    const c = target.category;
    return {
      name: c.name,
      slug: c.slug,
      parent_id: c.parent_id ?? "",
      description: c.description ?? "",
      image_url: c.image_url,
      is_visible: c.is_visible,
      seo: c.seo,
    };
  }
  return {
    name: "",
    slug: "",
    parent_id: target?.mode === "new" ? (target.parentId ?? "") : "",
    description: "",
    image_url: null,
    is_visible: true,
    seo: { title: "", description: "" },
  };
}

export function CategoryDrawer({
  target,
  categories,
  onOpenChange,
  onDelete,
}: {
  target: CategoryDrawerTarget | null;
  categories: AdminCategory[];
  onOpenChange: (open: boolean) => void;
  onDelete: (category: AdminCategory) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => valuesFor(target));
  const [lastTarget, setLastTarget] = useState(target);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  /** Archivos subidos en esta edición que todavía no se guardaron (para limpiar si se cancela). */
  const pendingUploads = useRef<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (target !== lastTarget) {
    setLastTarget(target);
    setValues(valuesFor(target));
    setErrors({});
    setSlugTouched(target?.mode === "edit");
  }

  const editing = target?.mode === "edit" ? target.category : null;
  const excluded = editing ? new Set([editing.id, ...descendantsOf(categories, editing.id)]) : new Set<string>();
  const flat = flattenTree(categories);
  const parentOptions = flat
    .filter((f) => !excluded.has(f.id) && f.depth < MAX_CATEGORY_DEPTH - 1)
    .map((f) => ({ value: f.id, label: categoryPath(categories, f.id) }));

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const close = async () => {
    if (pendingUploads.current.length) {
      await removeUploaded(pendingUploads.current);
      pendingUploads.current = [];
    }
    onOpenChange(false);
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const up = await uploadImage(file, "categories");
      pendingUploads.current.push(up.path);
      set("image_url", up.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    const res = await saveCategory({
      id: editing?.id ?? null,
      name: values.name,
      slug: slugTouched ? values.slug : editing ? values.slug : "",
      parent_id: values.parent_id || null,
      description: values.description,
      image_url: values.image_url,
      is_visible: values.is_visible,
      seo: values.seo,
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    // Lo subido quedó en uso; lo que se reemplazó lo borra la action.
    pendingUploads.current = pendingUploads.current.filter((p) => !values.image_url?.includes(p));
    if (pendingUploads.current.length) await removeUploaded(pendingUploads.current);
    pendingUploads.current = [];
    toast.success(editing ? "Categoría guardada" : "Categoría creada");
    onOpenChange(false);
  };

  return (
    <Drawer
      open={Boolean(target)}
      onOpenChange={(o) => {
        if (!o) void close();
      }}
      width="w-[min(520px,100vw)]"
      title={editing ? "Editar categoría" : "Nueva categoría"}
      description={editing ? `/categoria/${editing.slug}` : undefined}
      dismissable={!saving}
      footer={
        <>
          {editing ? (
            <Button variant="ghost" icon={<Trash2 />} className="mr-auto text-adm-danger hover:text-adm-danger" onClick={() => onDelete(editing)}>
              Borrar
            </Button>
          ) : null}
          <Button onClick={() => void close()} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving} disabled={uploading}>
            {editing ? "Guardar" : "Crear categoría"}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Nombre" required error={errors.name}>
          <Input value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={100} autoFocus />
        </Field>
        <Field label="Categoría madre" hint="Dejala vacía para que sea de primer nivel." error={errors.parent_id}>
          <Select value={values.parent_id} onChange={(e) => set("parent_id", e.target.value)}>
            <option value="">Ninguna (primer nivel)</option>
            {parentOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Descripción" hint="Se muestra arriba del listado de la categoría." error={errors.description}>
          <Textarea rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Imagen</span>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          {values.image_url ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- vista previa */}
              <img src={values.image_url} alt="" className="size-20 rounded-adm border border-adm-border object-cover" />
              <div className="flex flex-col items-start gap-1">
                <Button size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
                  Cambiar
                </Button>
                <Button size="sm" variant="ghost" icon={<X />} onClick={() => set("image_url", null)}>
                  Quitar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-20 w-full items-center gap-2 rounded-adm border border-dashed border-adm-input-border px-4 text-[13px] text-adm-fg-muted hover:bg-adm-hover hover:text-adm-fg"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
              {uploading ? "Subiendo…" : "Subir imagen (se usa en bloques de categorías)"}
            </button>
          )}
          {errors.image_url ? <p className="text-xs text-adm-danger">{errors.image_url[0]}</p> : null}
        </div>

        <Switch
          label="Visible en la tienda"
          description="Si la ocultás, no aparece en menús ni filtros; sus productos siguen a la venta."
          checked={values.is_visible}
          onCheckedChange={(v) => set("is_visible", v)}
        />

        <div className="border-t border-adm-border pt-4">
          <h3 className="mb-3 text-sm font-semibold">Buscadores (SEO)</h3>
          <SeoFields
            value={{ title: values.seo.title, description: values.seo.description, slug: values.slug }}
            onChange={(patch) => {
              if (patch.slug !== undefined) setSlugTouched(true);
              setValues((v) => ({
                ...v,
                slug: patch.slug ?? v.slug,
                seo: { title: patch.title ?? v.seo.title, description: patch.description ?? v.seo.description },
              }));
            }}
            fallbackTitle={values.name}
            fallbackDescription={values.description}
            pathPrefix="/categoria/"
            errors={{ title: errors["seo.title"], description: errors["seo.description"], slug: errors.slug }}
            slugHint={editing ? "Si la cambiás, la URL vieja redirige sola a la nueva." : "Si la dejás vacía se arma con el nombre."}
          />
        </div>
      </form>
    </Drawer>
  );
}
