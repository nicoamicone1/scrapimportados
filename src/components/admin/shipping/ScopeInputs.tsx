"use client";

import { X } from "lucide-react";
import { useId } from "react";

import { Badge, Checkbox, Textarea, type BadgeTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { parsePostalPrefixes, POSTAL_PREFIX_RE, PROVINCES } from "@/lib/shipping/provinces";
import { ZONE_TYPE_LABELS, type ShippingZoneType } from "@/lib/shipping/resolve";

const TYPE_TONES: Record<ShippingZoneType, BadgeTone> = {
  polygon: "teal",
  provinces: "blue",
  postal_prefixes: "purple",
  everywhere: "neutral",
};

/** Badge del tipo de zona (Polígono / Provincias / Códigos postales / Todo el país). */
export function ZoneTypeBadge({ type }: { type: ShippingZoneType }) {
  return (
    <Badge tone={TYPE_TONES[type]} dot={false}>
      {ZONE_TYPE_LABELS[type]}
    </Badge>
  );
}

/** Grilla de checkboxes con las 24 jurisdicciones. */
export function ProvincePicker({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
  error?: string | null;
}) {
  const selected = new Set(value);
  const toggle = (code: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(code);
    else next.delete(code);
    // Mantiene el orden de PROVINCES.
    onChange(PROVINCES.filter((p) => next.has(p.code)).map((p) => p.code));
  };

  return (
    <fieldset aria-invalid={Boolean(error) || undefined} aria-describedby={error ? "provinces-error" : undefined}>
      <legend className="sr-only">Provincias incluidas</legend>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="tnum text-adm-fg-muted">
          {value.length === 0 ? "Ninguna elegida" : `${value.length} de ${PROVINCES.length} elegidas`}
        </span>
        <button type="button" className="text-adm-accent hover:underline" onClick={() => onChange(PROVINCES.map((p) => p.code))}>
          Seleccionar todas
        </button>
        <button type="button" className="text-adm-accent hover:underline" onClick={() => onChange([])}>
          Ninguna
        </button>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {PROVINCES.map((p) => (
          <Checkbox
            key={p.code}
            label={p.name}
            checked={selected.has(p.code)}
            onChange={(e) => toggle(p.code, e.target.checked)}
          />
        ))}
      </div>
      {error ? (
        <p id="provinces-error" className="mt-2 text-xs text-adm-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Textarea de prefijos postales + chips (válidos e inválidos). */
export function PostalPrefixesInput({
  text,
  onTextChange,
  error,
}: {
  text: string;
  onTextChange: (text: string) => void;
  error?: string | null;
}) {
  const id = useId();
  const prefixes = parsePostalPrefixes(text);
  const invalid = prefixes.filter((p) => !POSTAL_PREFIX_RE.test(p));

  const remove = (prefix: string) => onTextChange(prefixes.filter((p) => p !== prefix).join(", "));

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-adm-fg">
        Prefijos de código postal
      </label>
      <Textarea
        id={id}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={4}
        spellCheck={false}
        invalid={Boolean(error) || invalid.length > 0}
        aria-describedby={`${id}-desc`}
        placeholder={"1900, 1901, 19\nB1878"}
        className="font-mono text-[13px]"
      />
      <p id={`${id}-desc`} className={cn("text-xs", error || invalid.length ? "text-adm-danger" : "text-adm-fg-muted")}>
        {error
          ? error
          : invalid.length
            ? `No son válidos: ${invalid.join(", ")}. Usá de 1 a 4 dígitos (19, 1900) o un CPA (B1900ABC).`
            : "Separalos con coma o salto de línea. “19” incluye todos los CP que empiezan con 19 (1900 a 1999). Del CPA B1900ABC se toman los dígitos."}
      </p>
      {prefixes.length ? (
        <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Prefijos cargados">
          {prefixes.map((p) => {
            const bad = !POSTAL_PREFIX_RE.test(p);
            return (
              <li
                key={p}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-adm-sm border pr-1 pl-2 font-mono text-xs",
                  bad ? "border-adm-danger/40 bg-adm-danger-soft text-adm-danger" : "border-adm-border bg-adm-surface-2 text-adm-fg",
                )}
              >
                {p}
                <button
                  type="button"
                  onClick={() => remove(p)}
                  aria-label={`Quitar ${p}`}
                  className="inline-flex size-4 items-center justify-center rounded-[3px] text-adm-fg-muted hover:bg-adm-border hover:text-adm-fg"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
