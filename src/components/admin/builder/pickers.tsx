"use client";

import { GripVertical, Loader2, Plus, Search, X } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { fetchProducts, searchProducts } from "@/app/admin/(panel)/paginas/actions";
import { FEATURE_ICON_LABELS, FEATURE_ICONS } from "@/components/blocks/icons";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import type { CategoryOption, ProductOption } from "@/lib/admin/pages";
import { isoToZonedLocal, zonedLocalToIso } from "@/lib/blocks/datetime";
import type { ProductSource } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";

import type { LinkSuggestion } from "./fields";

/* Datos compartidos por los formularios de bloques (categorías, tags, links, zona horaria). */

export interface BuilderOptions {
  categories: CategoryOption[];
  tags: string[];
  links: LinkSuggestion[];
  timezone: string;
}

const OptionsContext = createContext<BuilderOptions>({ categories: [], tags: [], links: [], timezone: "America/Argentina/Buenos_Aires" });

export const BuilderOptionsProvider = OptionsContext.Provider;

export function useBuilderOptions() {
  return useContext(OptionsContext);
}

// ---------------------------------------------------------------------------
// Fuente de productos
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<ProductSource["kind"], string> = {
  newest: "Lo más nuevo",
  featured: "Destacados",
  on_sale: "En oferta (con promo o precio tachado)",
  category: "De una categoría",
  tag: "Con una etiqueta",
  manual: "Elegidos a mano",
};

export function ProductSourceField({ value, onChange, limitHint }: { value: ProductSource; onChange: (v: ProductSource) => void; limitHint?: string }) {
  const { categories, tags } = useBuilderOptions();
  const limit = "limit" in value ? value.limit : 12;

  const changeKind = (kind: ProductSource["kind"]) => {
    switch (kind) {
      case "manual":
        return onChange({ kind, productIds: [] });
      case "category":
        return onChange({ kind, categoryId: categories[0]?.id ?? "", limit });
      case "tag":
        return onChange({ kind, tag: tags[0] ?? "", limit });
      default:
        return onChange({ kind, limit });
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Qué productos mostrar">
        <Select
          value={value.kind}
          onChange={(e) => changeKind(e.target.value as ProductSource["kind"])}
          options={(Object.keys(SOURCE_LABELS) as ProductSource["kind"][]).map((k) => ({ value: k, label: SOURCE_LABELS[k] }))}
        />
      </Field>

      {value.kind === "category" ? (
        <Field label="Categoría" hint="Incluye los productos de sus subcategorías.">
          <Select
            value={value.categoryId}
            placeholder="Elegí una categoría"
            onChange={(e) => onChange({ ...value, categoryId: e.target.value })}
            options={categories.map((c) => ({ value: c.id, label: `${"  ".repeat(c.depth)}${c.name}${c.isVisible ? "" : " (oculta)"}` }))}
          />
        </Field>
      ) : null}

      {value.kind === "tag" ? (
        <TagInput value={value.tag} onChange={(tag) => onChange({ ...value, tag })} suggestions={tags} />
      ) : null}

      {value.kind === "manual" ? (
        <ManualProducts ids={value.productIds} onChange={(productIds) => onChange({ kind: "manual", productIds })} />
      ) : (
        <Field label="Cantidad máxima" hint={limitHint}>
          <Input
            type="number"
            min={1}
            max={48}
            value={limit}
            onChange={(e) => {
              const n = Math.min(48, Math.max(1, Math.round(Number(e.target.value) || 1)));
              onChange({ ...value, limit: n } as ProductSource);
            }}
          />
        </Field>
      )}
      {value.kind === "on_sale" ? (
        <p className="text-xs text-adm-fg-muted">Si no hay promociones activas ni precios tachados, el bloque no se muestra en la tienda.</p>
      ) : null}
      {value.kind === "featured" ? (
        <p className="text-xs text-adm-fg-muted">Marcá productos como destacados desde Productos. Sin destacados, el bloque no se muestra.</p>
      ) : null}
    </div>
  );
}

function TagInput({ value, onChange, suggestions }: { value: string; onChange: (v: string) => void; suggestions: string[] }) {
  return (
    <Field label="Etiqueta" hint={suggestions.length ? "Elegí una etiqueta que ya tengan tus productos." : "Tus productos todavía no tienen etiquetas."}>
      <Input value={value} list="builder-tags" onChange={(e) => onChange(e.target.value)} placeholder="ciberlunes" />
    </Field>
  );
}

/** Selección manual de productos: buscador + lista ordenable. */
function ManualProducts({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const [known, setKnown] = useState<Record<string, ProductOption>>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [pending, startTransition] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Etiquetas de los productos ya elegidos.
  const missing = useMemo(() => ids.filter((id) => !known[id]), [ids, known]);
  useEffect(() => {
    if (!missing.length) return;
    let cancelled = false;
    void fetchProducts(missing).then((r) => {
      if (cancelled || !r.ok) return;
      setKnown((k) => ({ ...k, ...Object.fromEntries(r.data.map((p) => [p.id, p])) }));
    });
    return () => {
      cancelled = true;
    };
  }, [missing]);

  const search = (term: string) => {
    setQ(term);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const r = await searchProducts(term);
        if (r.ok) {
          setResults(r.data);
          setKnown((k) => ({ ...k, ...Object.fromEntries(r.data.map((p) => [p.id, p])) }));
        }
      });
    }, 250);
  };

  const add = (id: string) => {
    if (ids.includes(id) || ids.length >= 48) return;
    onChange([...ids, id]);
  };

  return (
    <div className="space-y-2">
      <span className="text-[13px] font-medium text-adm-fg">Productos ({ids.length})</span>
      {ids.length ? (
        <ul className="divide-y divide-adm-border rounded-adm border border-adm-border">
          {ids.map((id, i) => {
            const p = known[id];
            return (
              <li
                key={id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === i) return;
                  const next = [...ids];
                  const [x] = next.splice(dragIndex, 1);
                  next.splice(i, 0, x);
                  onChange(next);
                  setDragIndex(null);
                }}
                className="flex h-10 items-center gap-2 px-2 text-[13px]"
              >
                <GripVertical className="size-4 shrink-0 cursor-grab text-adm-fg-muted" aria-hidden />
                <Thumb url={p?.imageUrl ?? null} />
                <span className="min-w-0 flex-1 truncate">{p?.name ?? "Cargando…"}</span>
                {p && p.status !== "active" ? <span className="text-xs text-adm-warning">{p.status === "draft" ? "Borrador" : "Archivado"}</span> : null}
                <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${p?.name ?? "producto"}`} onClick={() => onChange(ids.filter((x) => x !== id))}>
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-adm-fg-muted">Buscá productos por nombre o SKU y agregalos.</p>
      )}
      <Input
        leading={pending ? <Loader2 className="animate-spin" /> : <Search />}
        value={q}
        placeholder="Buscar productos…"
        onChange={(e) => search(e.target.value)}
        onFocus={() => !results.length && search(q)}
        aria-label="Buscar productos para agregar"
      />
      {results.length ? (
        <ul className="adm-scroll max-h-64 divide-y divide-adm-border overflow-y-auto rounded-adm border border-adm-border">
          {results.map((p) => {
            const added = ids.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => add(p.id)}
                  className="flex h-10 w-full items-center gap-2 px-2 text-left text-[13px] hover:bg-adm-hover disabled:opacity-50"
                >
                  <Thumb url={p.imageUrl} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.sku ? <span className="font-mono text-[11px] text-adm-fg-muted">{p.sku}</span> : null}
                  {added ? <span className="text-xs text-adm-fg-muted">Agregado</span> : <Plus className="size-4 text-adm-fg-muted" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="relative size-7 shrink-0 overflow-hidden rounded-[4px] border border-adm-border bg-adm-surface-2">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura de producto (cualquier dominio).
        <img src={url} alt="" className="absolute inset-0 size-full object-contain" loading="lazy" />
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export function CategoryIdsField({ value, onChange }: { value: string[] | "all"; onChange: (v: string[] | "all") => void }) {
  const { categories } = useBuilderOptions();
  const [q, setQ] = useState("");
  const all = value === "all";
  const selected = all ? [] : value;
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const filtered = categories.filter((c) => !q.trim() || c.path.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-2.5">
      <div role="radiogroup" aria-label="Qué categorías" className="space-y-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={all} onChange={() => onChange("all")} className="accent-[var(--adm-accent)]" />
          Todas las principales (con productos)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={!all} onChange={() => onChange([])} className="accent-[var(--adm-accent)]" />
          Elegir cuáles y en qué orden
        </label>
      </div>
      {!all ? (
        <>
          {selected.length ? (
            <ol className="flex flex-wrap gap-1.5">
              {selected.map((id, i) => (
                <li key={id} className="inline-flex h-7 items-center gap-1 rounded-adm-sm border border-adm-border bg-adm-surface-2 pr-1 pl-2 text-xs">
                  <span className="tnum text-adm-fg-muted">{i + 1}.</span>
                  {byId.get(id)?.name ?? "Categoría borrada"}
                  <button type="button" aria-label="Quitar" onClick={() => onChange(selected.filter((x) => x !== id))} className="rounded p-0.5 hover:bg-adm-surface">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-adm-fg-muted">Marcá las categorías en el orden en que querés mostrarlas.</p>
          )}
          <Input size="sm" leading={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar categorías" aria-label="Filtrar categorías" />
          <ul className="adm-scroll max-h-56 overflow-y-auto rounded-adm border border-adm-border py-1">
            {filtered.map((c) => {
              const checked = selected.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex h-8 cursor-pointer items-center gap-2 px-2 text-[13px] hover:bg-adm-hover" style={{ paddingLeft: 8 + (q ? 0 : c.depth * 14) }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onChange(checked ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
                      className="accent-[var(--adm-accent)]"
                    />
                    <span className="truncate">{q ? c.path : c.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ícono (features)
// ---------------------------------------------------------------------------

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const Current = FEATURE_ICONS[value];
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-adm-fg">Ícono</span>
      <Button size="md" className="justify-start" onClick={() => setOpen((o) => !o)} aria-expanded={open} icon={Current ? <Current /> : undefined}>
        {FEATURE_ICON_LABELS[value] ?? "Elegir ícono"}
      </Button>
      {open ? (
        <div role="listbox" aria-label="Íconos" className="grid grid-cols-6 gap-1 rounded-adm border border-adm-border bg-adm-surface p-1.5">
          {Object.entries(FEATURE_ICONS).map(([name, Icon]) =>
            Icon ? (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={name === value}
                title={FEATURE_ICON_LABELS[name]}
                aria-label={FEATURE_ICON_LABELS[name]}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 items-center justify-center rounded-[4px] text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg",
                  name === value && "bg-adm-accent text-adm-accent-fg hover:bg-adm-accent hover:text-adm-accent-fg",
                )}
              >
                <Icon className="size-4" strokeWidth={1.5} />
              </button>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fecha y hora en la zona de la tienda
// ---------------------------------------------------------------------------

export function DateTimeField({ label, value, onChange, hint }: { label: string; value: string; onChange: (iso: string) => void; hint?: string }) {
  const { timezone } = useBuilderOptions();
  const local = isoToZonedLocal(value, timezone);
  const [now] = useState(() => Date.now());
  const past = Date.parse(value) <= now;
  return (
    <Field label={label} hint={past ? "Esa fecha ya pasó: se muestra el texto de cierre." : hint ?? `Hora de la tienda (${timezone.split("/").pop()?.replace(/_/g, " ")}).`}>
      <Input
        type="datetime-local"
        value={local}
        onChange={(e) => {
          const iso = zonedLocalToIso(e.target.value, timezone);
          if (iso) onChange(iso);
        }}
      />
    </Field>
  );
}

/** `<datalist>` global de tags (lo usa TagInput). */
export function TagsDatalist() {
  const { tags } = useBuilderOptions();
  return (
    <datalist id="builder-tags">
      {tags.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  );
}
