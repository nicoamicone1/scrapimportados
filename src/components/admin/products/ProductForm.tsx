"use client";

import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SeoFields } from "@/components/admin/SeoFields";
import { StatusBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/dates";
import type { CategoryNodeInput } from "@/lib/admin/category-tree";
import type { AdminImage, AdminProductDetail } from "@/lib/admin/products";
import { stripHtml } from "@/lib/html";
import { PRODUCT_SOURCE_LABELS, PRODUCT_STATUS_LABELS, VAT_RATES, type ProductStatus } from "@/lib/schemas/product";

import { saveProduct, setProductStatus } from "@/app/admin/(panel)/productos/actions";

import { CategoryTreeSelect } from "./CategoryTreeSelect";
import { emptyFormState, formStateFromProduct, snapshot, toPayload, type ProductFormState } from "./form-state";
import { ImageManager } from "./ImageManager";
import { DeleteProductDialog, DuplicateProductDialog } from "./ProductDialogs";
import { RichTextEditor } from "./RichTextEditor";
import { RelatedEditor, SpecsEditor } from "./SpecsEditor";
import { ChipsInput } from "./TagsInput";
import { VariantsEditor } from "./VariantsEditor";

type Errors = Record<string, string[] | undefined>;

interface DraftEnvelope {
  savedAt: string;
  state: ProductFormState;
}

const draftKeyFor = (id: string | null) => `ecommy:product-draft:${id ?? "nuevo"}`;

function readDraft(key: string): DraftEnvelope | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope;
    return parsed && typeof parsed.savedAt === "string" && parsed.state ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, state: ProductFormState) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), state } satisfies DraftEnvelope));
  } catch {
    // Sin almacenamiento local (modo privado): el borrador local es opcional.
  }
}

function removeDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // idem
  }
}

export interface ProductFormProps {
  product: AdminProductDetail | null;
  categories: CategoryNodeInput[];
  brands: string[];
  tags: string[];
  siteName?: string;
}

export function ProductForm({ product, categories, brands, tags, siteName }: ProductFormProps) {
  const router = useRouter();
  const initial = useMemo(() => (product ? formStateFromProduct(product) : emptyFormState()), [product]);
  const [state, setState] = useState<ProductFormState>(initial);
  const [baseline, setBaseline] = useState(() => snapshot(initial));
  const [meta, setMeta] = useState<AdminProductDetail | null>(product);
  const [productId, setProductId] = useState<string | null>(product?.id ?? null);
  const [images, setImages] = useState<AdminImage[]>(product?.images ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftEnvelope | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const savingRef = useRef(false);

  const dirty = snapshot(state) !== baseline;
  const draftKey = draftKeyFor(productId);

  // Borrador local: ofrecer restaurar al entrar.
  useEffect(() => {
    // localStorage sólo existe en el navegador: se lee después de hidratar.
    const t = window.setTimeout(() => {
      const found = readDraft(draftKeyFor(product?.id ?? null));
      if (found && snapshot(found.state) !== snapshot(initial)) setDraft(found);
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al montar
  }, []);

  // Autoguardado local mientras hay cambios.
  useEffect(() => {
    if (draft) return; // no pisar un borrador que todavía no se restauró/descartó
    const t = setTimeout(() => {
      if (dirty) writeDraft(draftKey, state);
      else removeDraft(draftKey);
    }, 600);
    return () => clearTimeout(t);
  }, [state, dirty, draftKey, draft]);

  // Aviso al cerrar la pestaña con cambios.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = useCallback(<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const err = (key: string) => errors[key];

  const applySaved = (p: AdminProductDetail) => {
    const next = formStateFromProduct(p);
    setState(next);
    setBaseline(snapshot(next));
    setMeta(p);
    setImages(p.images);
    setErrors({});
  };

  const save = async (): Promise<AdminProductDetail | null> => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await saveProduct(toPayload(state, productId));
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>('#product-form [aria-invalid="true"]');
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
          el?.focus({ preventScroll: true });
        });
        return null;
      }
      const p = res.data.product;
      removeDraft(draftKeyFor(productId));
      removeDraft(draftKeyFor(p.id));
      applySaved(p);
      return p;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onSubmit = async () => {
    const wasNew = !productId;
    const p = await save();
    if (!p) return;
    toast.success(wasNew ? "Producto creado" : "Cambios guardados");
    if (wasNew) router.replace(`/admin/productos/${p.id}`);
    else router.refresh();
  };

  /** Para subir imágenes en un producto nuevo: se guarda primero (como borrador si no eligió estado). */
  const ensureProductId = async (): Promise<string | null> => {
    if (productId) return productId;
    if (!state.name.trim()) {
      setErrors({ name: ["Poné el nombre antes de subir imágenes."] });
      document.getElementById("product-name")?.focus();
      toast.error("Poné el nombre del producto para poder subir imágenes.");
      return null;
    }
    const p = await save();
    if (!p) return null;
    setProductId(p.id);
    window.history.replaceState(null, "", `/admin/productos/${p.id}`);
    toast.success("Guardamos el producto como borrador para subir las imágenes");
    return p.id;
  };

  const discard = () => {
    const base = meta ? formStateFromProduct(meta) : emptyFormState();
    setState(base);
    setBaseline(snapshot(base));
    setErrors({});
    removeDraft(draftKey);
  };

  const changeStatusNow = async (status: ProductStatus) => {
    if (!productId) return;
    const res = await setProductStatus(productId, status);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setState((s) => ({ ...s, status }));
    setBaseline((b) => {
      const parsed = JSON.parse(b) as ProductFormState;
      return JSON.stringify({ ...parsed, status });
    });
    setMeta((m) => (m ? { ...m, status } : m));
    toast.success(status === "archived" ? "Producto archivado" : status === "active" ? "Producto publicado" : "Producto en borrador");
    router.refresh();
  };

  const savedSlug = meta?.slug ?? "";
  const storePath = savedSlug ? `/producto/${savedSlug}` : "";
  const isActive = meta?.status === "active";
  const usedImages = new Set(state.variants.map((v) => v.image_id).filter((x): x is string => Boolean(x)));
  const title = state.name.trim() || (productId ? "Producto sin nombre" : "Nuevo producto");

  return (
    <div id="product-form">
      <PageHeader
        breadcrumb={[{ label: "Productos", href: "/admin/productos" }, { label: productId ? title : "Nuevo" }]}
        title={title}
        description={
          meta ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusBadge kind="product" value={meta.status} />
              <span>
                Actualizado <time suppressHydrationWarning title={formatDateTime(meta.updated_at)}>{formatRelative(meta.updated_at)}</time>
              </span>
            </span>
          ) : (
            "Completá lo básico y guardalo como borrador: podés publicarlo cuando esté listo."
          )
        }
        actions={
          <>
            {storePath ? (
              isActive ? (
                <ButtonLink href={storePath} external icon={<ExternalLink />}>
                  Ver en la tienda
                </ButtonLink>
              ) : (
                <ButtonLink href={`${storePath}?preview=1`} external icon={<Eye />}>
                  Vista previa
                </ButtonLink>
              )
            ) : null}
            {productId && meta ? (
              <DropdownMenu
                width={232}
                trigger={
                  <Button size="icon" aria-label="Más acciones">
                    <MoreHorizontal />
                  </Button>
                }
              >
                <DropdownItem icon={<Copy />} onSelect={() => setDuplicateOpen(true)}>
                  Duplicar
                </DropdownItem>
                <DropdownItem
                  icon={<Link2 />}
                  onSelect={() => {
                    void navigator.clipboard
                      .writeText(`${window.location.origin}${storePath}`)
                      .then(() => toast.success("Link copiado"))
                      .catch(() => toast.error("No se pudo copiar el link"));
                  }}
                >
                  Copiar link
                </DropdownItem>
                <DropdownSeparator />
                {meta.status === "archived" ? (
                  <>
                    <DropdownItem icon={<ArchiveRestore />} onSelect={() => void changeStatusNow("draft")}>
                      Restaurar como borrador
                    </DropdownItem>
                    <DropdownItem icon={<Trash2 />} danger disabled={meta.has_orders} onSelect={() => setDeleteOpen(true)}>
                      {meta.has_orders ? "Tiene pedidos: no se puede eliminar" : "Eliminar definitivamente"}
                    </DropdownItem>
                  </>
                ) : (
                  <DropdownItem icon={<Archive />} onSelect={() => void changeStatusNow("archived")}>
                    Archivar
                  </DropdownItem>
                )}
              </DropdownMenu>
            ) : null}
            <Button variant="primary" onClick={onSubmit} loading={saving} disabled={!dirty && Boolean(productId)} className="hidden md:inline-flex">
              {productId ? "Guardar" : "Crear producto"}
            </Button>
          </>
        }
      />

      {draft ? (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-adm border border-[#E9D3A8] bg-[#F5EAD3] px-4 py-2.5 text-[13px] text-[#7A4A00]">
          <span className="flex-1">
            Tenés cambios sin guardar de <time suppressHydrationWarning title={formatDateTime(draft.savedAt)}>{formatRelative(draft.savedAt)}</time> en este navegador.
          </span>
          <Button
            size="sm"
            onClick={() => {
              setState(draft.state);
              setDraft(null);
              toast.success("Recuperamos tus cambios. Guardalos para no perderlos.");
            }}
          >
            Recuperar cambios
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[#7A4A00] hover:bg-[#EBDDBF] hover:text-[#5C3800]"
            onClick={() => {
              removeDraft(draftKeyFor(product?.id ?? null));
              setDraft(null);
            }}
          >
            Descartar
          </Button>
        </div>
      ) : null}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            void onSubmit();
          }
        }}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
      >
        {/* Columna principal */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardBody className="space-y-4 p-5">
              <Field label="Nombre" required error={err("name")}>
                <Input
                  id="product-name"
                  value={state.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={200}
                  placeholder="Ej.: Remera oversize de algodón"
                  autoFocus={!productId}
                />
              </Field>
              <Field label="Descripción" error={err("description_html")}>
                <RichTextEditor value={state.description_html} onChange={(html) => set("description_html", html)} />
              </Field>
              <Field
                label="Descripción corta"
                hint="Una línea para listados y, si no completás el SEO, para Google."
                error={err("short_description")}
                aside={<span className="tnum">{state.short_description.length}/300</span>}
              >
                <Textarea rows={2} value={state.short_description} maxLength={300} onChange={(e) => set("short_description", e.target.value)} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Imágenes" description="Arrastrá, pegá o elegí varias. La primera es la principal." />
            <CardBody>
              <ImageManager
                productId={productId}
                images={images}
                onChange={setImages}
                ensureProductId={ensureProductId}
                usedByVariants={usedImages}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Precio, stock y variantes"
              description="Si se vende en talles o colores, agregá opciones y se arman las variantes solas."
            />
            <CardBody>
              <VariantsEditor
                options={state.options}
                variants={state.variants}
                images={images}
                errors={errors}
                onChange={(options, variants) => setState((s) => ({ ...s, options, variants }))}
                stockNote={state.stock_note}
                onStockNote={(v) => set("stock_note", v)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ficha técnica" description="Características en formato tabla." />
            <CardBody>
              <SpecsEditor value={state.specs} onChange={(v) => set("specs", v)} productId={productId} errors={errors} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Productos relacionados" description="Aparecen en la ficha como «También te puede interesar». Hasta 8." />
            <CardBody>
              <RelatedEditor
                value={state.related}
                onChange={(v) => set("related", v)}
                productId={productId}
                error={err("related_ids")?.[0]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Buscadores (SEO)" description="Cómo aparece en Google y al compartir el link." />
            <CardBody>
              <SeoFields
                value={{ title: state.seo.title, description: state.seo.description, slug: state.slug }}
                onChange={(patch) => {
                  setState((s) => ({
                    ...s,
                    slug: patch.slug ?? s.slug,
                    seo: {
                      title: patch.title ?? s.seo.title,
                      description: patch.description ?? s.seo.description,
                    },
                  }));
                }}
                fallbackTitle={state.name}
                fallbackDescription={state.short_description || stripHtml(state.description_html).slice(0, 160)}
                pathPrefix="/producto/"
                siteName={siteName}
                errors={{ title: err("seo.title"), description: err("seo.description"), slug: err("slug") }}
                slugHint={
                  productId
                    ? "Si la cambiás, la URL vieja redirige sola a la nueva."
                    : "Si la dejás vacía se arma con el nombre."
                }
              />
            </CardBody>
          </Card>
        </div>

        {/* Lateral */}
        <div className="min-w-0 space-y-5 lg:sticky lg:top-4">
          <Card>
            <CardHeader title="Estado" />
            <CardBody className="space-y-3">
              <Select
                aria-label="Estado"
                value={state.status}
                onChange={(e) => set("status", e.target.value as ProductStatus)}
                options={(["active", "draft", "archived"] as const).map((s) => ({ value: s, label: PRODUCT_STATUS_LABELS[s] }))}
              />
              <p className="text-xs text-adm-fg-muted">
                {state.status === "active"
                  ? "Visible en la tienda y se puede comprar."
                  : state.status === "draft"
                    ? "No se ve en la tienda. Usá «Vista previa» para revisarlo."
                    : "Oculto y fuera de los listados. Conserva su historial."}
              </p>
              <Switch
                label="Destacado"
                description="Aparece en los bloques de destacados."
                checked={state.featured}
                onCheckedChange={(v) => set("featured", v)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Organización" />
            <CardBody className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">Categorías</span>
                <CategoryTreeSelect categories={categories} value={state.category_ids} onChange={(v) => set("category_ids", v)} />
                {err("category_ids") ? <p className="text-xs text-adm-danger">{err("category_ids")?.[0]}</p> : null}
              </div>
              <Field label="Marca" error={err("brand")}>
                <Input value={state.brand} onChange={(e) => set("brand", e.target.value)} list="adm-brands" maxLength={80} />
              </Field>
              <datalist id="adm-brands">
                {brands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
              <Field label="Etiquetas" hint="Para agrupar en bloques y filtros. Enter para agregar." error={err("tags")}>
                <ChipsInput value={state.tags} onChange={(v) => set("tags", v)} suggestions={tags} max={30} placeholder="verano, oferta…" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Impuestos" />
            <CardBody>
              <Field
                label="Alícuota de IVA"
                hint="Se usa para mostrar el precio sin impuestos nacionales (Ley 27.743) si lo activás en Configuración."
                error={err("vat_percent")}
              >
                <Select
                  value={state.vat_percent}
                  onChange={(e) => set("vat_percent", e.target.value)}
                  options={[
                    { value: "", label: "Por defecto de la tienda" },
                    ...VAT_RATES.map((r) => ({ value: String(r), label: `${String(r).replace(".", ",")} %` })),
                  ]}
                />
              </Field>
            </CardBody>
          </Card>

          {meta && meta.source !== "manual" ? (
            <Card>
              <CardHeader title="Origen" />
              <CardBody className="space-y-1 text-[13px]">
                <p>{PRODUCT_SOURCE_LABELS[meta.source]}</p>
                {meta.source_url ? (
                  <a
                    href={meta.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-adm-accent hover:underline"
                  >
                    <span className="truncate">{hostOf(meta.source_url)}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </a>
                ) : null}
                <p className="text-xs text-adm-fg-muted">Si volvés a sincronizar desde Importar, el precio y el stock pueden cambiar.</p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Barra de guardado */}
        <div
          className={cn(
            "sticky bottom-0 z-20 -mx-4 items-center justify-end gap-2 border-t border-adm-border bg-adm-surface px-4 py-2.5 md:-mx-6 md:px-6 lg:col-span-2",
            dirty ? "flex" : "flex md:hidden",
          )}
        >
          {dirty ? <span className="mr-auto text-[13px] text-adm-fg-muted">Cambios sin guardar</span> : null}
          {dirty && productId ? (
            <Button variant="ghost" onClick={discard} disabled={saving}>
              Descartar
            </Button>
          ) : null}
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty && Boolean(productId)}>
            {productId ? "Guardar" : "Crear producto"}
          </Button>
        </div>
      </form>

      {meta ? (
        <>
          <DuplicateProductDialog
            product={duplicateOpen ? { id: meta.id, name: meta.name } : null}
            onOpenChange={setDuplicateOpen}
          />
          <DeleteProductDialog
            product={deleteOpen ? { id: meta.id, name: meta.name } : null}
            onOpenChange={setDeleteOpen}
            onDeleted={() => {
              removeDraft(draftKey);
              router.replace("/admin/productos?estado=archivados");
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).host + new URL(url).pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}
