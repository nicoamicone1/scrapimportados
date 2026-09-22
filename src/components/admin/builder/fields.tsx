"use client";

import { ArrowDown, ArrowUp, ChevronDown, ImageUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui";
import type { Cta } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";

import { IMAGE_ACCEPT, uploadMedia } from "./upload";

/*
 * Controles compactos del panel de settings del builder (tokens --adm-*).
 */

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b border-adm-border px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-adm-fg">{title}</h3>
        {aside}
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return <p className="rounded-adm border border-[#E9D5A8] bg-[#FBF3E2] px-2.5 py-2 text-xs text-[#7A4A00]">{children}</p>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-adm-fg-muted">{children}</p>;
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  maxLength,
  multiline,
  rows = 3,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  error?: string | null;
}) {
  return (
    <Field label={label} hint={hint} error={error} aside={maxLength && value.length > maxLength * 0.8 ? `${value.length}/${maxLength}` : undefined}>
      {multiline ? (
        <Textarea rows={rows} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      <Select value={value} onChange={(e) => onChange(e.target.value as T)} options={options} />
    </Field>
  );
}

/** Botonera segmentada (alineación, tamaños…). */
export function Segmented<T extends string | number>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[13px] font-medium text-adm-fg">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex rounded-adm border border-adm-input-border bg-adm-surface p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              title={o.title}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-[4px] px-1.5 text-[13px] whitespace-nowrap transition-colors [&_svg]:size-4",
                active ? "bg-adm-accent text-adm-accent-fg" : "text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-xs text-adm-fg-muted">{hint}</p> : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  hint?: ReactNode;
  suffix?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        trailing={suffix}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
        }}
      />
    </Field>
  );
}

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 5,
  suffix = "%",
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-adm-fg">
          {label}
        </label>
        <span className="tnum text-xs text-adm-fg-muted">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--adm-accent)]"
      />
      {hint ? <div className="text-xs text-adm-fg-muted">{hint}</div> : null}
    </div>
  );
}

export function ToggleField({ label, description, checked, onChange }: { label: string; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return <Switch label={label} description={description} checked={checked} onCheckedChange={onChange} />;
}

/** Input de link con sugerencias (rutas de la tienda, categorías, páginas). */
export function LinkInput({
  value,
  onChange,
  suggestions,
  placeholder = "/productos",
  id,
  invalid,
  "aria-describedby": describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: LinkSuggestion[];
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  const listId = useId();
  return (
    <>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        list={listId}
        invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="font-mono text-[13px]"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s.href} value={s.href}>
            {s.label}
          </option>
        ))}
      </datalist>
    </>
  );
}

export interface LinkSuggestion {
  href: string;
  label: string;
}

export function hrefError(href: string): string | null {
  const v = href.trim();
  if (!v) return null;
  if (/^\s*(javascript|data|vbscript):/i.test(v)) return "Ese link no está permitido.";
  if (/^(\/|#|https?:\/\/|mailto:|tel:)/i.test(v)) return null;
  return "Empezá con «/» (ej. /productos) o con https://";
}

export function CtaField({
  label,
  value,
  onChange,
  suggestions,
  optional,
  hint,
}: {
  label: string;
  value: Cta | undefined;
  onChange: (v: Cta | undefined) => void;
  suggestions: LinkSuggestion[];
  optional?: boolean;
  hint?: ReactNode;
}) {
  const enabled = Boolean(value);
  const cta = value ?? { label: "", href: "" };
  return (
    <fieldset className="space-y-2.5 rounded-adm border border-adm-border p-3">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-[13px] font-medium text-adm-fg">{label}</legend>
        {optional ? (
          <Switch
            aria-label={`Mostrar ${label.toLowerCase()}`}
            checked={enabled}
            onCheckedChange={(on) => onChange(on ? { label: "Ver más", href: "/productos" } : undefined)}
          />
        ) : null}
      </div>
      {!optional || enabled ? (
        <>
          <Field label="Texto">
            <Input value={cta.label} maxLength={80} onChange={(e) => onChange({ ...cta, label: e.target.value })} />
          </Field>
          <Field label="Destino" error={hrefError(cta.href)} hint={hint}>
            <LinkInput value={cta.href} onChange={(href) => onChange({ ...cta, href })} suggestions={suggestions} />
          </Field>
        </>
      ) : null}
    </fieldset>
  );
}

/** Imagen: URL + subir archivo + vista previa. */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  folder = "pages",
  aspect = "16 / 9",
  optional,
  frameClassName,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: ReactNode;
  folder?: "pages" | "brand";
  aspect?: string;
  optional?: boolean;
  /** Clases extra del recuadro de vista previa (ej. limitar el ancho de un favicon). */
  frameClassName?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const id = useId();

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadMedia(file, folder));
      toast.success("Imagen subida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-adm-fg">
          {label}
        </label>
        {optional ? <span className="text-xs text-adm-fg-muted">Opcional</span> : null}
      </div>
      <div
        className={cn("relative overflow-hidden rounded-adm border border-adm-border bg-adm-surface-2", frameClassName)}
        style={{ aspectRatio: aspect }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files[0]);
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de una URL arbitraria.
          <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-adm-fg-muted hover:text-adm-fg"
          >
            <ImageUp className="size-5" aria-hidden />
            Subí o arrastrá una imagen
          </button>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-adm-surface/80">
            <Loader2 className="size-5 animate-spin text-adm-fg-muted" aria-label="Subiendo" />
          </div>
        ) : null}
      </div>
      <div className="flex gap-1.5">
        <Input
          id={id}
          size="sm"
          value={value}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value.trim())}
          className="min-w-0 flex-1 font-mono text-xs"
          spellCheck={false}
        />
        <Button size="sm" icon={<ImageUp />} onClick={() => fileRef.current?.click()} disabled={uploading}>
          Subir
        </Button>
        {value ? (
          <Button size="icon-sm" variant="ghost" aria-label="Quitar imagen" onClick={() => onChange("")}>
            <X />
          </Button>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => void upload(e.target.files?.[0])} />
      {hint ? <p className="text-xs text-adm-fg-muted">{hint}</p> : null}
    </div>
  );
}

/** Lista de ítems editable: agregar, quitar, subir/bajar, colapsar. */
export function ItemsEditor<T>({
  items,
  onChange,
  max,
  addLabel,
  create,
  itemTitle,
  renderItem,
  empty,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  max: number;
  addLabel: string;
  create: () => T;
  itemTitle: (item: T, index: number) => string;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  empty?: ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(items.length ? 0 : null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
    setOpen(to);
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && empty ? <div className="text-xs text-adm-fg-muted">{empty}</div> : null}
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-adm border border-adm-border bg-adm-surface">
            <div className="flex items-center gap-1 pr-1">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex h-9 min-w-0 flex-1 items-center gap-2 px-2.5 text-left text-[13px]"
              >
                <ChevronDown className={cn("size-4 shrink-0 text-adm-fg-muted transition-transform", !isOpen && "-rotate-90")} aria-hidden />
                <span className="tnum text-adm-fg-muted">{i + 1}.</span>
                <span className="truncate">{itemTitle(item, i) || "Sin título"}</span>
              </button>
              <Button size="icon-sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)}>
                <ArrowUp />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Bajar" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
                <ArrowDown />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Quitar"
                onClick={() => {
                  onChange(items.filter((_, j) => j !== i));
                  setOpen(null);
                }}
              >
                <Trash2 />
              </Button>
            </div>
            {isOpen ? (
              <div className="space-y-3 border-t border-adm-border p-3">
                {renderItem(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}
              </div>
            ) : null}
          </div>
        );
      })}
      {items.length < max ? (
        <Button
          size="sm"
          icon={<Plus />}
          onClick={() => {
            onChange([...items, create()]);
            setOpen(items.length);
          }}
        >
          {addLabel}
        </Button>
      ) : (
        <Note>Llegaste al máximo de {max}.</Note>
      )}
    </div>
  );
}

export function ColorField({ label, value, onChange, allowEmpty, hint }: { label: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean; hint?: ReactNode }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    // El valor cambió desde afuera (preset, descartar): sincronizar el texto.
    setPrev(value);
    setText(value);
  }
  const valid = /^#[0-9a-fA-F]{6}$/.test(text);
  const commit = (v: string) => {
    setText(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v) || (allowEmpty && v === "")) onChange(v.toUpperCase());
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-adm-fg">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}: elegir color`}
          value={valid ? text : /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
          onChange={(e) => commit(e.target.value.toUpperCase())}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-adm border border-adm-input-border bg-adm-surface p-0.5"
        />
        <Input
          id={id}
          value={text}
          placeholder={allowEmpty ? "Sin color" : "#000000"}
          invalid={Boolean(text) && !valid}
          onChange={(e) => commit(e.target.value.trim())}
          className="font-mono text-[13px] uppercase"
          maxLength={7}
          spellCheck={false}
        />
        {allowEmpty && text ? (
          <Button size="icon-sm" variant="ghost" aria-label="Quitar color" onClick={() => commit("")}>
            <X />
          </Button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-adm-fg-muted">{hint}</p> : null}
    </div>
  );
}
