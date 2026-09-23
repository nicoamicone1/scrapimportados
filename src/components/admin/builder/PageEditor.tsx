"use client";

import { ArrowLeft, ExternalLink, FileText, History, Monitor, MoreHorizontal, Plus, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { discardDraft, savePage, setPageStatus, type SaveMode } from "@/app/admin/(panel)/paginas/actions";
import { useAdminStore } from "@/components/admin/AdminStoreContext";
import { SeoFields } from "@/components/admin/SeoFields";
import { StatusBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui";
import type { AdminPage } from "@/lib/admin/pages";
import { BLOCK_META, cloneBlock, createBlock } from "@/lib/blocks/defaults";
import type { Block, BlockType } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/dates";
import { PAGE_TYPE_LABELS, pageSlugError, type PageSeo, type PageType } from "@/lib/schemas/page";
import type { Theme } from "@/lib/theme";

import type { PreviewDevice } from "../appearance/preview-css";

import { BlockList } from "./BlockList";
import { BlockPalette } from "./BlockPalette";
import { BlockSettings } from "./BlockSettings";
import { BuilderPreview } from "./BuilderPreview";
import { ImageField, Section } from "./fields";
import { BuilderOptionsProvider, TagsDatalist, type BuilderOptions } from "./pickers";
import type { BlockPreviewNode } from "./render-preview";

interface Meta {
  title: string;
  slug: string;
  type: PageType;
  showInMenu: boolean;
  seo: PageSeo;
}

interface Content {
  meta: Meta;
  blocks: Block[];
}

interface LocalDraft extends Content {
  at: number;
}

const storageKey = (id: string) => `ecommy:builder:${id}`;

function readLocal(id: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function PageEditor({
  page,
  theme,
  options,
  siteUrl,
  storeName,
  initialNodes,
}: {
  page: AdminPage;
  theme: Theme;
  options: BuilderOptions;
  siteUrl: string;
  storeName: string;
  initialNodes: BlockPreviewNode[];
}) {
  const router = useRouter();
  const storeRoot = useAdminStore().store.href;
  const isHome = page.type === "home";

  const liveContent: Content = useMemo(
    () => ({ meta: { title: page.title, slug: page.slug, type: page.type, showInMenu: page.showInMenu, seo: page.seo }, blocks: page.blocks }),
    [page],
  );
  const startContent: Content = page.draft
    ? { meta: { title: page.draft.title, slug: page.draft.slug, type: page.type, showInMenu: page.draft.showInMenu, seo: page.draft.seo }, blocks: page.draft.blocks }
    : liveContent;

  const [meta, setMeta] = useState<Meta>(startContent.meta);
  const [blocks, setBlocks] = useState<Block[]>(startContent.blocks);
  const [saved, setSaved] = useState(() => JSON.stringify(startContent));
  const [live, setLive] = useState<Content>(liveContent);
  const [status, setStatus] = useState(page.status);
  const [hasDraft, setHasDraft] = useState(Boolean(page.draft));
  const [draftAt, setDraftAt] = useState(page.draft?.updatedAt ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState<SaveMode | null>(null);
  const [slugServerError, setSlugServerError] = useState<string | null>(null);
  const [restore, setRestore] = useState<LocalDraft | null>(null);

  const current: Content = useMemo(() => ({ meta, blocks }), [meta, blocks]);
  const currentJson = JSON.stringify(current);
  const dirty = currentJson !== saved;
  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const slugError = slugServerError ?? pageSlugError(meta.slug, { isHome });

  // ------------------------------------------------------------ Borrador local
  useEffect(() => {
    const local = readLocal(page.id);
    if (local && JSON.stringify({ meta: local.meta, blocks: local.blocks }) !== saved) {
      // Leer localStorage recién en el cliente (no en el render del server).
      const t = window.setTimeout(() => setRestore(local), 0);
      return () => window.clearTimeout(t);
    }
    // Sólo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lectura inicial única
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey(page.id), JSON.stringify({ ...current, at: Date.now() }));
      } catch {
        // Sin espacio o modo privado: no pasa nada.
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [current, dirty, page.id]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const clearLocal = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey(page.id));
    } catch {
      // ignorar
    }
  }, [page.id]);

  // ------------------------------------------------------------ Bloques
  // Callbacks estables: la lista de bloques y el preview están memoizados.
  const updateBlock = useCallback((next: Block) => setBlocks((bs) => bs.map((b) => (b.id === next.id ? next : b))), []);

  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((bs) => {
      const at = selectedId ? bs.findIndex((b) => b.id === selectedId) + 1 : bs.length;
      const next = [...bs];
      next.splice(at > 0 ? at : bs.length, 0, block);
      return next;
    });
    setSelectedId(block.id);
  };

  const duplicateBlock = useCallback((id: string) => {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const copy = cloneBlock(bs[i]);
      setSelectedId(copy.id);
      return [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)];
    });
  }, []);

  const deleteBlock = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const toggleHidden = useCallback(
    (id: string) =>
      setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, style: { ...b.style, hidden: b.style.hidden ? undefined : true } } as Block) : b))),
    [],
  );

  // ------------------------------------------------------------ Guardar
  const save = useCallback(
    async (mode: SaveMode) => {
      if (saving) return;
      if (slugError) {
        setSelectedId(null);
        toast.error(slugError);
        return;
      }
      setSaving(mode);
      const r = await savePage(
        { id: page.id, title: meta.title, slug: meta.slug, type: meta.type, showInMenu: meta.showInMenu, seo: meta.seo, blocks },
        mode,
      );
      setSaving(null);
      if (!r.ok) {
        const slugMsg = r.fieldErrors?.slug?.[0];
        if (slugMsg) {
          setSlugServerError(slugMsg);
          setSelectedId(null);
        }
        const firstBlockError = Object.keys(r.fieldErrors ?? {}).find((k) => k.startsWith("blocks."));
        if (firstBlockError) {
          const idx = Number(firstBlockError.split(".")[1]);
          if (blocks[idx]) setSelectedId(blocks[idx].id);
        }
        toast.error(r.error);
        return;
      }
      setSaved(JSON.stringify(current));
      setStatus(r.data.status);
      setHasDraft(r.data.hasDraft);
      setDraftAt(r.data.hasDraft ? r.data.updatedAt : null);
      if (!r.data.hasDraft) setLive(current);
      clearLocal();
      toast.success(
        mode === "publish"
          ? status === "published"
            ? "Cambios publicados"
            : "Página publicada"
          : r.data.hasDraft
            ? "Borrador guardado. La tienda sigue mostrando la versión publicada."
            : "Guardado",
      );
      router.refresh();
    },
    [blocks, clearLocal, current, meta, page.id, router, saving, slugError, status],
  );

  // ------------------------------------------------------------ Atajos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save("draft");
        return;
      }
      if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
      if (mod && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        duplicateBlock(selectedId);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        setConfirmDelete(selectedId);
      } else if (e.key === "Escape" && selectedId) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duplicateBlock, save, selectedId]);

  // "Ver en la tienda": URL de la tienda activa (`/s/<slug>/…` en modo fallback).
  const publicUrl = isHome ? storeRoot : `${storeRoot.replace(/\/+$/, "")}/${live.meta.slug}`;
  const deleting = blocks.find((b) => b.id === confirmDelete);

  return (
    <BuilderOptionsProvider value={options}>
      <TagsDatalist />
      {/* El editor ocupa toda la ventana (como los builders de Shopify/Tiendanube): más lugar para el preview. */}
      <div className="fixed inset-0 z-40 flex flex-col bg-adm-bg">
        {/* Barra superior */}
        <header className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-adm-border bg-adm-surface px-4 py-2">
          <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 text-[13px] text-adm-fg-muted">
            <Link href="/admin/paginas" className="inline-flex items-center gap-1 hover:text-adm-fg hover:underline" title="Volver a Páginas">
              <ArrowLeft className="size-4" aria-hidden />
              Páginas
            </Link>
            <span aria-hidden>/</span>
            <h1 className="truncate text-sm font-semibold text-adm-fg">{isHome ? "Portada" : meta.title || "Sin título"}</h1>
          </nav>
          <StatusBadge kind="page" value={status} />
          {hasDraft && !dirty ? (
            <span className="inline-flex items-center gap-1 text-xs text-adm-fg-muted" title={draftAt ? new Date(draftAt).toLocaleString("es-AR") : undefined} suppressHydrationWarning>
              <History className="size-3.5" aria-hidden />
              Borrador sin publicar{draftAt ? ` · ${formatRelative(draftAt)}` : ""}
            </span>
          ) : null}
          {dirty ? <span className="text-xs font-medium text-adm-warning">Cambios sin guardar</span> : null}

          <div className="ml-auto flex items-center gap-2">
            <div role="radiogroup" aria-label="Dispositivo" className="flex rounded-adm border border-adm-input-border p-0.5">
              {(
                [
                  { value: "desktop", label: "Computadora", icon: Monitor },
                  { value: "mobile", label: "Celular", icon: Smartphone },
                ] as const
              ).map((d) => (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={device === d.value}
                  aria-label={d.label}
                  title={d.label}
                  onClick={() => setDevice(d.value)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-[4px]",
                    device === d.value ? "bg-adm-accent text-adm-accent-fg" : "text-adm-fg-muted hover:bg-adm-surface-2",
                  )}
                >
                  <d.icon className="size-4" aria-hidden />
                </button>
              ))}
            </div>
            {status === "published" ? (
              <ButtonLink href={publicUrl} external size="md" variant="ghost" icon={<ExternalLink />}>
                Ver página
              </ButtonLink>
            ) : null}
            <DropdownMenu
              trigger={
                <Button size="icon" variant="ghost" aria-label="Más acciones">
                  <MoreHorizontal />
                </Button>
              }
            >
              <DropdownItem icon={<FileText />} onSelect={() => setSelectedId(null)}>
                Datos y SEO de la página
              </DropdownItem>
              {hasDraft ? (
                <DropdownItem icon={<History />} onSelect={() => setConfirmDiscard(true)}>
                  Descartar borrador
                </DropdownItem>
              ) : null}
              {status === "published" && !isHome ? (
                <>
                  <DropdownSeparator />
                  <DropdownItem danger onSelect={() => setConfirmUnpublish(true)}>
                    Despublicar
                  </DropdownItem>
                </>
              ) : null}
            </DropdownMenu>
            <Button onClick={() => void save("draft")} loading={saving === "draft"} disabled={!dirty || Boolean(saving)} title="Ctrl+S">
              {status === "published" ? "Guardar borrador" : "Guardar"}
            </Button>
            <Button
              variant="primary"
              onClick={() => void save("publish")}
              loading={saving === "publish"}
              disabled={Boolean(saving) || (status === "published" && !dirty && !hasDraft)}
            >
              {status === "published" ? "Publicar cambios" : "Publicar"}
            </Button>
          </div>
        </header>

        {restore ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[#E9D5A8] bg-[#FBF3E2] px-4 py-2 text-[13px] text-[#7A4A00]">
            <span>Tenés cambios de esta página que no llegaste a guardar ({formatRelative(restore.at)}).</span>
            <Button
              size="sm"
              onClick={() => {
                setMeta(restore.meta);
                setBlocks(restore.blocks);
                setRestore(null);
              }}
            >
              Recuperarlos
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearLocal();
                setRestore(null);
              }}
            >
              Descartar
            </Button>
          </div>
        ) : null}
        {page.invalidBlocks || page.draft?.invalidBlocks ? (
          <div className="border-b border-adm-border bg-adm-danger-soft px-4 py-2 text-[13px] text-adm-danger">
            Se descartaron {page.draft?.invalidBlocks ?? page.invalidBlocks} bloque(s) guardados con datos inválidos. Guardá para limpiar la página.
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          {/* Lista de bloques */}
          <aside className="flex w-[272px] shrink-0 flex-col border-r border-adm-border bg-adm-surface" aria-label="Bloques">
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <h2 className="text-[13px] font-semibold text-adm-fg">
                Bloques <span className="tnum font-normal text-adm-fg-muted">{blocks.length}</span>
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)} aria-pressed={!selectedId}>
                Página
              </Button>
            </div>
            <div className="adm-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {blocks.length ? (
                <BlockList
                  blocks={blocks}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={setBlocks}
                  onToggleHidden={toggleHidden}
                  onDuplicate={duplicateBlock}
                  onDelete={setConfirmDelete}
                />
              ) : (
                <p className="px-2 py-3 text-[13px] text-adm-fg-muted">Todavía no hay bloques. Empezá por una portada o un carrusel de productos.</p>
              )}
            </div>
            <div className="border-t border-adm-border p-3">
              <Button className="w-full" icon={<Plus />} onClick={() => setPaletteOpen(true)}>
                Agregar bloque
              </Button>
              <p className="mt-2 text-center text-[11px] text-adm-fg-muted">Ctrl+S guarda · Ctrl+D duplica · Supr borra</p>
            </div>
          </aside>

          {/* Preview */}
          <div className="adm-scroll min-w-0 flex-1 overflow-y-auto bg-adm-bg p-4">
            <BuilderPreview blocks={blocks} theme={theme} device={device} selectedId={selectedId} onSelect={setSelectedId} initialNodes={initialNodes} />
          </div>

          {/* Settings */}
          <aside className="adm-scroll w-[340px] shrink-0 overflow-y-auto border-l border-adm-border bg-adm-surface" aria-label="Configuración">
            {selected ? (
              <>
                <div className="sticky top-0 z-10 flex h-11 items-center justify-between border-b border-adm-border bg-adm-surface pr-2 pl-4">
                  <h2 className="text-sm font-semibold text-adm-fg">{BLOCK_META[selected.type].label}</h2>
                  <Button size="icon-sm" variant="ghost" aria-label="Cerrar" onClick={() => setSelectedId(null)}>
                    <X />
                  </Button>
                </div>
                <BlockSettings block={selected} onChange={updateBlock} />
              </>
            ) : (
              <PageSettings
                meta={meta}
                isHome={isHome}
                siteUrl={siteUrl}
                storeName={storeName}
                slugError={slugError}
                onChange={(patch) => {
                  if (patch.slug !== undefined) setSlugServerError(null);
                  setMeta((m) => ({ ...m, ...patch }));
                }}
                publishedSlug={status === "published" ? live.meta.slug : null}
              />
            )}
          </aside>
        </div>
      </div>

      <BlockPalette open={paletteOpen} onOpenChange={setPaletteOpen} onPick={addBlock} />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={deleting ? `¿Borrar el bloque «${BLOCK_META[deleting.type].label}»?` : "¿Borrar el bloque?"}
        description="Lo podés recuperar sólo si no guardaste todavía (Descartar cambios)."
        confirmLabel="Borrar bloque"
        destructive
        onConfirm={() => {
          if (confirmDelete) deleteBlock(confirmDelete);
        }}
      />
      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="¿Despublicar la página?"
        description={`/${live.meta.slug} deja de verse en la tienda. Podés volver a publicarla cuando quieras.`}
        confirmLabel="Despublicar"
        destructive
        onConfirm={async () => {
          const r = await setPageStatus(page.id, "draft");
          if (!r.ok) return void toast.error(r.error);
          setStatus("draft");
          toast.success("La página ya no se ve en la tienda");
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="¿Descartar el borrador?"
        description="Se pierden los cambios sin publicar y el editor vuelve a la versión que se ve en la tienda."
        confirmLabel="Descartar borrador"
        destructive
        onConfirm={async () => {
          const r = await discardDraft(page.id);
          if (!r.ok) return void toast.error(r.error);
          setMeta(live.meta);
          setBlocks(live.blocks);
          setSaved(JSON.stringify(live));
          setHasDraft(false);
          setDraftAt(null);
          clearLocal();
          toast.success("Borrador descartado");
          router.refresh();
        }}
      />
    </BuilderOptionsProvider>
  );
}

function PageSettings({
  meta,
  isHome,
  siteUrl,
  storeName,
  slugError,
  onChange,
  publishedSlug,
}: {
  meta: Meta;
  isHome: boolean;
  siteUrl: string;
  storeName: string;
  slugError: string | null;
  onChange: (patch: Partial<Meta>) => void;
  publishedSlug: string | null;
}) {
  return (
    <div>
      <div className="flex h-11 items-center border-b border-adm-border px-4">
        <h2 className="text-sm font-semibold text-adm-fg">{isHome ? "Portada" : "Página"}</h2>
      </div>
      <Section title="Datos">
        <Field label="Título" hint="Se usa en el listado del admin, en los menús y como título en Google si no cargás uno propio.">
          <Input value={meta.title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
        {!isHome ? (
          <Field label="Tipo">
            <Select
              value={meta.type}
              onChange={(e) => onChange({ type: e.target.value as PageType })}
              options={(["landing", "legal", "custom"] as const).map((t) => ({ value: t, label: PAGE_TYPE_LABELS[t] }))}
            />
          </Field>
        ) : null}
        {!isHome ? (
          <Switch
            label="Mostrar en el menú"
            description="Aparece en la lista de páginas del menú de la tienda."
            checked={meta.showInMenu}
            onCheckedChange={(showInMenu) => onChange({ showInMenu })}
          />
        ) : null}
      </Section>
      <Section title="Buscadores y redes">
        <SeoFields
          value={{ title: meta.seo.title, description: meta.seo.description, slug: isHome ? undefined : meta.slug }}
          onChange={(patch) => {
            const { slug, ...seo } = patch;
            onChange({ ...(slug !== undefined ? { slug } : {}), seo: { ...meta.seo, ...seo } });
          }}
          fallbackTitle={meta.title}
          pathPrefix="/"
          siteUrl={siteUrl}
          siteName={storeName}
          errors={{ slug: slugError ?? undefined }}
          slugHint={
            publishedSlug && publishedSlug !== meta.slug
              ? `Al publicar, /${publishedSlug} va a redirigir a /${meta.slug}.`
              : "Sólo minúsculas, números y guiones."
          }
        />
        <ImageField
          label="Imagen para compartir"
          optional
          aspect="1200 / 630"
          value={meta.seo.og_image_url}
          onChange={(og_image_url) => onChange({ seo: { ...meta.seo, og_image_url } })}
          hint="1200 × 630 px. Es la foto que aparece al compartir el link por WhatsApp o redes."
        />
      </Section>
    </div>
  );
}
