"use client";

import { useId } from "react";

import { QtyStepper } from "@/components/store/QtyStepper";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { REVIEW_REASON_LABELS } from "@/lib/print3d";
import type { ItemChoice, LengthUnit, PublicConfig, ReviewReason } from "@/lib/print3d/types";

import { colorHasStock, type PieceEval } from "./evaluate";
import { formatDims, formatGrams, formatPrintTime } from "./shared";

const UNITS: { value: LengthUnit; label: string }[] = [
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
  { value: "in", label: "pulg" },
];

const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PieceEditorProps {
  name: string;
  config: PublicConfig;
  choice: ItemChoice;
  unit: LengthUnit;
  scalePct: number;
  /** Unidad sugerida si la pieza parece estar en cm o pulgadas (null = no hay aviso). */
  suggestedUnit: LengthUnit | null;
  evaluation: PieceEval | null;
  /** Cama más grande (para explicar `no_fit`). */
  biggestBed: [number, number, number] | null;
  onChoice: (patch: Partial<ItemChoice>) => void;
  onUnit: (unit: LengthUnit) => void;
  onScale: (pct: number) => void;
}

/** Texto del chip de revisión, con el dato concreto cuando lo hay. */
export function reasonText(reason: ReviewReason, ctx: { bed: [number, number, number] | null; maxHours: number }): string {
  const base = REVIEW_REASON_LABELS[reason];
  if (reason === "no_fit" && ctx.bed) return `${base.replace(/\.$/, "")}: la cama más grande es de ${formatDims(ctx.bed)}.`;
  if (reason === "too_long") return `${base.replace(/\.$/, "")} (más de ${ctx.maxHours} h por pieza).`;
  return base;
}

/** Fila de una propiedad del editor: etiqueta a la izquierda (arriba en mobile). */
function Row({ label, value, children, htmlFor }: { label: string; value?: string; children: React.ReactNode; htmlFor?: string }) {
  const head = (
    <>
      {label}
      {value ? <span className="tnum block text-xs font-normal text-fg-muted">{value}</span> : null}
    </>
  );
  return (
    <div className="grid gap-2 border-t border-border py-4 first:border-t-0 first:pt-0 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-medium sm:pt-2.5">
          {head}
        </label>
      ) : (
        <p className="text-sm font-medium sm:pt-2.5">{head}</p>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PieceEditor(props: PieceEditorProps) {
  const { config, choice, evaluation: ev, onChoice } = props;
  const uid = useId();
  const material = config.materials.find((m) => m.id === choice.material_id) ?? null;
  const materials = config.materials.filter((m) => m.colors.length);
  const grams = ev?.estimate.grams ?? 0;

  return (
    <div>
      {/* Medidas y unidades */}
      <Row label="Medidas" value={ev ? formatDims(ev.geometry.bbox) : undefined}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-border-strong" role="radiogroup" aria-label="Unidades del archivo">
            {UNITS.map((u) => (
              <button
                key={u.value}
                type="button"
                role="radio"
                aria-checked={props.unit === u.value}
                onClick={() => props.onUnit(u.value)}
                className={cn(
                  "min-h-10 min-w-12 px-3 text-sm transition-colors",
                  props.unit === u.value ? "bg-fg text-bg" : "hover:bg-surface",
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-fg-muted">Escala</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              step={5}
              value={props.scalePct}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) props.onScale(Math.min(1000, Math.max(1, n)));
              }}
              className="input tnum !min-h-10 w-20 text-right"
              aria-label="Escala en porcentaje"
            />
            <span className="text-fg-muted">%</span>
          </label>
        </div>
        {props.suggestedUnit ? (
          <p className="mt-2 text-sm text-fg-muted" role="status">
            Así mide muy poco: ¿el archivo está en {props.suggestedUnit === "in" ? "pulgadas" : "centímetros"}?{" "}
            <button type="button" className="link text-fg" onClick={() => props.onUnit(props.suggestedUnit!)}>
              Pasar a {props.suggestedUnit === "in" ? "pulgadas" : "cm"}
            </button>
          </p>
        ) : null}
      </Row>

      {/* Material */}
      <Row label="Material">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Material">
          {materials.map((m) => {
            const active = m.id === choice.material_id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                className="chip"
                onClick={() => {
                  if (active) return;
                  // Mismo color por nombre si existe en el material nuevo; si no, el primero con stock.
                  const current = material?.colors.find((c) => c.id === choice.color_id);
                  const same = m.colors.find((c) => current && c.name.toLowerCase() === current.name.toLowerCase());
                  const color = same ?? m.colors.find((c) => c.available_grams > 0) ?? m.colors[0];
                  onChoice({ material_id: m.id, color_id: color.id });
                }}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </Row>

      {/* Color */}
      {material ? (
        <Row label="Color" value={material.colors.find((c) => c.id === choice.color_id)?.name}>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Color del filamento">
            {material.colors.map((c) => {
              const active = c.id === choice.color_id;
              const enough = colorHasStock(c, grams, choice.qty);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={enough ? c.name : `${c.name}, sin stock`}
                  title={enough ? c.name : `${c.name} · sin stock`}
                  onClick={() => onChoice({ color_id: c.id })}
                  className={cn(
                    "p3d-swatch relative size-10 rounded-sm border border-border-strong transition-shadow",
                    active && "p3d-swatch-active",
                    !enough && "p3d-swatch-out",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
          {material.colors.some((c) => !colorHasStock(c, grams, choice.qty)) ? (
            <p className="mt-2 text-xs text-fg-muted">Los tachados no alcanzan para esta pieza: si lo elegís, lo revisa el taller.</p>
          ) : null}
        </Row>
      ) : null}

      {/* Calidad */}
      <Row label="Calidad" value="Altura de capa">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Calidad">
          {config.qualities.map((q) => {
            const active = q.id === choice.quality_id;
            return (
              <button
                key={q.id}
                type="button"
                role="radio"
                aria-checked={active}
                className="chip"
                onClick={() => onChoice({ quality_id: q.id })}
              >
                {q.name.replace(/\s*\d+[.,]\d+\s*(mm)?$/, "")}
                <span className="tnum text-xs opacity-70">{nf2.format(q.layer_height)} mm</span>
              </button>
            );
          })}
        </div>
      </Row>

      {/* Relleno */}
      <Row label="Relleno" value={`${choice.infill_pct} %`} htmlFor={`${uid}-infill`}>
        <input
          id={`${uid}-infill`}
          type="range"
          min={10}
          max={100}
          step={5}
          value={choice.infill_pct}
          onChange={(e) => onChoice({ infill_pct: Number(e.target.value) })}
          className="p3d-range w-full"
          aria-valuetext={`${choice.infill_pct} por ciento`}
        />
        <div className="tnum mt-1 flex justify-between text-xs text-fg-muted" aria-hidden>
          <span>10 %</span>
          <span>50 %</span>
          <span>100 %</span>
        </div>
        <p className="mt-1.5 text-xs text-fg-muted">
          {choice.infill_pct <= 20
            ? "Alcanza para piezas decorativas y figuras."
            : choice.infill_pct < 50
              ? "Para piezas de uso: soportes, ganchos, cajas."
              : "Para piezas que hacen fuerza o se atornillan."}
        </p>
      </Row>

      {/* Soportes */}
      <Row label="Soportes">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Soportes">
          {[
            { v: false, label: "Sin soportes" },
            { v: true, label: `Con soportes (+${config.settings.support_extra_pct} % material)` },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={choice.supports === o.v}
              className="chip"
              onClick={() => onChoice({ supports: o.v })}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-fg-muted">Van si la pieza tiene voladizos de más de 45° o puentes largos. Si no sabés, lo vemos nosotros.</p>
      </Row>

      {/* Cantidad */}
      <Row label="Cantidad">
        <QtyStepper value={choice.qty} onChange={(qty) => onChoice({ qty })} max={500} size="md" label={props.name} />
      </Row>
    </div>
  );
}

/** Lectura tipo laminador: gramos, horas, unitario y total de la pieza. */
export function PieceReadout({ evaluation: ev, qty }: { evaluation: PieceEval | null; qty: number }) {
  const cells = [
    { label: "Filamento", value: ev ? formatGrams(ev.estimate.grams) : "—", hint: qty > 1 && ev ? `${formatGrams(ev.estimate.grams * qty)} en total` : "por unidad" },
    { label: "Impresión", value: ev ? formatPrintTime(ev.estimate.minutes) : "—", hint: qty > 1 && ev ? `${formatPrintTime(ev.estimate.minutes * qty)} en total` : "por unidad" },
    { label: "Precio unitario", value: ev ? formatMoney(ev.estimate.unit_price) : "—", hint: null },
    { label: qty > 1 ? `Total × ${qty}` : "Total", value: ev ? formatMoney(ev.estimate.total) : "—", hint: null, strong: true },
  ];
  return (
    <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4" aria-live="polite">
      {cells.map((c, i) => (
        <div key={c.label} className={cn("px-3 py-3", i % 2 === 1 && "border-l border-border", i >= 2 && "max-sm:border-t sm:border-l")}>
          <dt className="text-[11px] tracking-[0.08em] text-fg-muted uppercase">{c.label}</dt>
          <dd className={cn("tnum mt-0.5 text-base", c.strong && "font-semibold")}>{c.value}</dd>
          {c.hint ? <dd className="tnum text-xs text-fg-muted">{c.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
