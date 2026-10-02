"use client";

import { Calculator } from "lucide-react";
import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import type { AdminMaterial } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber, formatPercent } from "@/lib/money";
import { quoteTotals } from "@/lib/print3d";
import type { Calibration, PriceSettings, PublicQuality } from "@/lib/print3d/types";

import { pickPrinterFor, simulatePiece, unitCost, type MachineInputs } from "./math";

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export interface SimulatorPrinter extends MachineInputs {
  status: string;
  materials: string[];
  name: string;
}

/**
 * "Una pieza de 100 g en PLA estándar sale $ X y tarda Y h": usa la misma
 * fórmula que el cotizador (§3.3) con los valores que estás editando, y el
 * costo real (§3.6) para mostrar el margen.
 */
export function PriceSimulator({
  settings,
  qualities,
  materials,
  calibration,
  printers,
  kwhPrice,
  laborHourCost,
  className,
}: {
  settings: PriceSettings;
  qualities: PublicQuality[];
  materials: AdminMaterial[];
  calibration: Calibration[];
  printers: SimulatorPrinter[];
  kwhPrice: number;
  laborHourCost: number;
  className?: string;
}) {
  const activeMaterials = materials.filter((m) => m.is_active);
  const [grams, setGrams] = useState("100");
  const [materialId, setMaterialId] = useState(activeMaterials[0]?.id ?? "");
  const [qualityCode, setQualityCode] = useState(
    qualities.find((q) => q.code === "standard")?.code ?? qualities[0]?.code ?? "",
  );

  const material = activeMaterials.find((m) => m.id === materialId) ?? activeMaterials[0];
  const quality = qualities.find((q) => q.code === qualityCode) ?? qualities[0];
  const g = Number(grams.replace(",", "."));

  if (!material || !quality) {
    return (
      <aside className={cn("rounded-adm border border-adm-border bg-adm-surface p-4 shadow-adm-card", className)}>
        <p className="flex items-center gap-2 text-sm font-semibold text-adm-fg">
          <Calculator className="size-4" aria-hidden />
          Simulador de precio
        </p>
        <p className="mt-2 text-[13px] text-adm-fg-muted">Necesitás al menos un material activo y una calidad para simular.</p>
      </aside>
    );
  }

  const valid = Number.isFinite(g) && g > 0 && g <= 100_000;
  const sim = valid
    ? simulatePiece({
        grams: g,
        material: { ...material, colors: [] },
        quality,
        settings,
        calibration,
      })
    : null;
  const printer = pickPrinterFor(printers, material.type);
  const cost = sim
    ? unitCost(
        { grams: sim.grams, minutes: sim.minutes, post_minutes: 0 },
        { spool_cost_per_gram: material.avg_cost_per_gram, printer, kwh_price: kwhPrice, labor_hour_cost: laborHourCost },
      )
    : null;
  const margin = sim && cost ? sim.unit_price - cost.total : null;
  const order = sim ? quoteTotals([sim.total], settings) : null;

  return (
    <aside
      aria-label="Simulador de precio"
      className={cn("overflow-hidden rounded-adm border border-adm-border bg-adm-surface shadow-adm-card", className)}
    >
      <div className="adm-dark bg-adm-sidebar-bg px-4 py-3 text-adm-sidebar-fg">
        <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-adm-sidebar-muted uppercase">
          <Calculator className="size-3.5" aria-hidden />
          Simulador
        </p>
        <p className="mt-1.5 text-[13px] leading-snug" aria-live="polite">
          Una pieza de <strong className="tnum font-semibold text-white">{valid ? formatNumber(g) : "—"} g</strong> en{" "}
          {material.name} {quality.name.toLowerCase()} sale
        </p>
        <p className="tnum mt-0.5 text-[28px] leading-9 font-semibold text-white">{sim ? formatMoney(sim.unit_price) : "—"}</p>
        <p className="tnum text-[13px] text-adm-sidebar-fg">
          y tarda <strong className="font-semibold text-adm-accent-2">{sim ? formatDuration(sim.minutes) : "—"}</strong> de máquina
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-[88px_1fr] gap-2">
          <Field label="Pieza">
            <Input size="sm" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} trailing="g" />
          </Field>
          <Field label="Material">
            <Select size="sm" value={material.id} onChange={(e) => setMaterialId(e.target.value)}>
              {activeMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div role="radiogroup" aria-label="Calidad" className="flex flex-wrap gap-1">
          {qualities.map((q) => (
            <button
              key={q.code}
              type="button"
              role="radio"
              aria-checked={q.code === quality.code}
              onClick={() => setQualityCode(q.code)}
              className={cn(
                "h-8 rounded-adm border px-2 text-xs transition-colors",
                q.code === quality.code
                  ? "border-adm-accent bg-adm-accent text-adm-accent-fg"
                  : "border-adm-input-border bg-adm-surface text-adm-fg-muted hover:text-adm-fg",
              )}
            >
              {q.name}
            </button>
          ))}
        </div>

        {sim ? (
          <dl className="tnum space-y-1 border-t border-adm-border pt-3 text-[13px]">
            <Row label={`Material (${formatNumber(sim.grams, "es-AR", sim.grams % 1 ? 1 : 0)} g × ${formatMoney(material.price_per_gram)})`} value={sim.materialPart} />
            <Row label={`Máquina (${formatDuration(sim.minutes)} × ${formatMoney(settings.hour_rate)})`} value={sim.machinePart} />
            {quality.price_multiplier !== 1 ? (
              <p className="text-xs text-adm-fg-muted">Incluye el multiplicador ×{formatNumber(quality.price_multiplier, "es-AR", 2)} de la calidad.</p>
            ) : null}
            {settings.post_process_fee > 0 ? <Row label="Post-proceso" value={settings.post_process_fee} /> : null}
            {sim.hitMinimum ? (
              <p className="text-xs text-adm-accent-2-ink">Gana el mínimo por pieza ({formatMoney(settings.min_piece_price)}).</p>
            ) : settings.round_to > 0 ? (
              <p className="text-xs text-adm-fg-muted">Redondeado hacia arriba a {formatMoney(settings.round_to)}.</p>
            ) : null}
          </dl>
        ) : (
          <p className="text-xs text-adm-danger">Ingresá un peso entre 1 y 100.000 g.</p>
        )}

        {sim && cost ? (
          <div className="rounded-adm bg-adm-surface-2 px-3 py-2.5">
            <dl className="tnum space-y-1 text-[13px]">
              <Row label="Te cuesta" value={cost.total} strong />
              <p className="text-xs text-adm-fg-muted">
                Filamento {formatMoney(cost.material)} · luz {formatMoney(cost.energy)} · amortización {formatMoney(cost.amortization)}
                {printer ? ` (${printer.name})` : ""}
              </p>
              {margin !== null ? (
                <div className="flex items-baseline justify-between gap-3 pt-1">
                  <dt className="text-adm-fg-muted">Ganás</dt>
                  <dd className={cn("font-semibold", margin < 0 ? "text-adm-danger" : "text-adm-success")}>
                    {formatMoney(margin)}
                    {sim.unit_price > 0 ? (
                      <span className="ml-1 text-xs font-normal text-adm-fg-muted">{formatPercent(Math.round((margin / sim.unit_price) * 100))}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            {cost.incomplete || material.avg_cost_per_gram === null ? (
              <p className="mt-1.5 text-xs text-adm-fg-muted">Sin costo de bobinas cargado: el filamento cuenta $ 0.</p>
            ) : null}
            {!printer ? <p className="mt-1.5 text-xs text-adm-fg-muted">Sin impresoras: no se cuenta luz ni amortización.</p> : null}
          </div>
        ) : null}

        {order && order.min_adjustment > 0 ? (
          <p className="text-xs text-adm-fg-muted">
            Si es el único ítem del pedido, se cobra el mínimo: <span className="tnum font-medium text-adm-fg">{formatMoney(order.total)}</span>.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-adm-fg-muted">{label}</dt>
      <dd className={cn("shrink-0 text-adm-fg", strong && "font-semibold")}>{formatMoney(value)}</dd>
    </div>
  );
}
