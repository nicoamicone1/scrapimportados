"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useSettingsForm } from "@/components/admin/settings/useSettingsForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { SaveBar } from "@/components/ui/SaveBar";
import { Switch } from "@/components/ui/Switch";
import type { AdminCalibration, AdminMaterial, AdminPrinter, AdminQuality, Print3dSettings } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";
import type { Calibration, PriceSettings, PublicQuality } from "@/lib/print3d/types";
import { slugify } from "@/lib/slug";

import { deleteQuality, resetCalibration, saveWorkshopConfig } from "@/app/admin/(panel)/taller-3d/configuracion/actions";

import { machineHourCost, pickPrinterFor } from "./math";
import { WEEK_DAYS } from "./presets";
import { PriceSimulator } from "./PriceSimulator";
import { Swatch } from "./Swatch";

type NumKey = Exclude<keyof Print3dSettings, "enabled" | "working_days" | "intro_md">;

interface QualityRow {
  key: string;
  id: string | null;
  code: string;
  name: string;
  layer_height: string;
  wall_mm: string;
  throughput_g_h: string;
  price_multiplier: string;
  is_active: boolean;
}

interface FormState {
  settings: Record<NumKey, string> & { enabled: boolean; working_days: number[]; intro_md: string };
  qualities: QualityRow[];
}

const str = (n: number) => String(n).replace(".", ",");
const num = (s: string, fallback = 0) => {
  const v = Number(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : fallback;
};

let tmp = 0;

function initialState(settings: Print3dSettings, qualities: AdminQuality[]): FormState {
  const { enabled, working_days, intro_md, ...nums } = settings;
  const strNums = Object.fromEntries(Object.entries(nums).map(([k, v]) => [k, typeof v === "number" ? str(v) : ""])) as Record<NumKey, string>;
  return {
    settings: { ...strNums, enabled, working_days, intro_md },
    qualities: qualities.map((q) => ({
      key: q.id,
      id: q.id,
      code: q.code,
      name: q.name,
      layer_height: str(q.layer_height),
      wall_mm: str(q.wall_mm),
      throughput_g_h: str(q.throughput_g_h),
      price_multiplier: str(q.price_multiplier),
      is_active: q.is_active,
    })),
  };
}

/** Códigos para calidades nuevas: del nombre, únicos ("fina-012", "fina-012-2"…). */
function withCodes(rows: QualityRow[]): QualityRow[] {
  const used = new Set(rows.filter((r) => r.id).map((r) => r.code));
  return rows.map((r, i) => {
    if (r.id) return r;
    const base = slugify(r.name, 24) || `calidad-${i + 1}`;
    let code = base;
    for (let n = 2; used.has(code); n++) code = `${base}-${n}`;
    used.add(code);
    return { ...r, code };
  });
}

export interface WorkshopSettingsProps {
  settings: Print3dSettings;
  qualities: AdminQuality[];
  materials: AdminMaterial[];
  calibration: AdminCalibration[];
  printers: AdminPrinter[];
}

/**
 * Configuración del taller (TALLER-3D §5): precios, calidades, calendario,
 * costos, cotizador y calibración, con el simulador de precio en vivo.
 */
export function WorkshopSettings({ settings, qualities, materials, calibration, printers }: WorkshopSettingsProps) {
  const form = useSettingsForm<FormState>(initialState(settings, qualities), (v) =>
    saveWorkshopConfig({ settings: v.settings, qualities: withCodes(v.qualities) }),
  );
  const { values, set, error, dirty } = form;
  const s = values.settings;
  const [qualityToDelete, setQualityToDelete] = useState<QualityRow | null>(null);
  const [resetAll, setResetAll] = useState(false);

  const setS = (key: keyof FormState["settings"], value: unknown) => set(`settings.${key}`, value);
  const setQ = (i: number, key: keyof QualityRow, value: unknown) => set(`qualities.${i}.${key}`, value);
  const err = (path: string) => error(path);

  const numField = (key: NumKey, label: string, opts: { hint?: string; leading?: string; trailing?: string } = {}) => (
    <Field label={label} hint={opts.hint} error={err(`settings.${key}`)}>
      <Input
        inputMode="decimal"
        value={s[key]}
        onChange={(e) => setS(key, e.target.value)}
        leading={opts.leading}
        trailing={opts.trailing}
      />
    </Field>
  );

  const addQuality = () =>
    form.setValues((v) => ({
      ...v,
      qualities: [
        ...v.qualities,
        {
          key: `new-${++tmp}`,
          id: null,
          code: "",
          name: "",
          layer_height: "0,16",
          wall_mm: "1,2",
          throughput_g_h: "12",
          price_multiplier: "1,1",
          is_active: true,
        },
      ],
    }));

  const removeQuality = (row: QualityRow) => {
    if (!row.id) {
      form.setValues((v) => ({ ...v, qualities: v.qualities.filter((q) => q.key !== row.key) }));
      return;
    }
    if (dirty) {
      toast.error("Guardá o descartá los cambios antes de borrar una calidad.");
      return;
    }
    setQualityToDelete(row);
  };

  const confirmDeleteQuality = async () => {
    if (!qualityToDelete?.id) return;
    const res = await deleteQuality(qualityToDelete.id);
    if (!res.ok) toast.error(res.error);
    else toast.success(`Borraste «${qualityToDelete.name}»`);
  };

  const reset = async (key: { material_id: string; quality_id: string } | null) => {
    const res = await resetCalibration(key);
    if (!res.ok) toast.error(res.error);
    else toast.success(key ? "Calibración reseteada" : "Toda la calibración volvió a ×1");
  };

  /* ── Datos vivos para el simulador ── */
  const priceSettings: PriceSettings = {
    hour_rate: num(s.hour_rate),
    min_piece_price: num(s.min_piece_price),
    min_order_price: num(s.min_order_price),
    setup_fee: num(s.setup_fee),
    post_process_fee: num(s.post_process_fee),
    support_extra_pct: num(s.support_extra_pct),
    round_to: num(s.round_to),
    max_auto_hours: num(s.max_auto_hours, 24),
  };
  const liveQualities: PublicQuality[] = withCodes(values.qualities)
    .filter((q) => q.is_active && num(q.throughput_g_h) > 0 && q.name.trim())
    .map((q) => ({
      id: q.id ?? `new:${q.code}`,
      code: q.code,
      name: q.name.trim(),
      layer_height: num(q.layer_height),
      wall_mm: num(q.wall_mm, 1.2),
      throughput_g_h: num(q.throughput_g_h),
      price_multiplier: num(q.price_multiplier, 1) || 1,
    }));
  const cal: Calibration[] = calibration.map((c) => ({ ...c }));
  const kwh = num(s.kwh_price);
  const sampleMaterialType = materials.find((m) => m.is_active)?.type ?? "PLA";
  const refPrinter = pickPrinterFor(printers, sampleMaterialType);
  const refHour = refPrinter ? machineHourCost(refPrinter, kwh) : null;

  const activeMaterials = materials.filter((m) => m.is_active);
  const savedQualities = qualities;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="space-y-4">
        {/* Precios */}
        <Card>
          <CardHeader title="Precios" description="Con esto se arma el precio de cada pieza que cotiza la tienda." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {numField("hour_rate", "Hora de máquina (venta)", {
              leading: "$",
              trailing: "/h",
              hint: refHour ? `A vos te cuesta ${formatMoney(refHour.total)}/h en la ${refPrinter?.name}.` : "Lo que cobrás por cada hora de impresión.",
            })}
            {numField("min_piece_price", "Mínimo por pieza", { leading: "$", hint: "Ninguna pieza sale menos que esto." })}
            {numField("min_order_price", "Mínimo por pedido", { leading: "$", hint: "Si el pedido no llega, se agrega un ajuste." })}
            {numField("setup_fee", "Preparación por pedido", { leading: "$", hint: "Laminado y armado del plato. 0 = no se cobra." })}
            {numField("post_process_fee", "Post-proceso por pieza", { leading: "$", hint: "Sacar soportes, lijado básico." })}
            {numField("support_extra_pct", "Material extra con soportes", { trailing: "%", hint: "Cuánto filamento más gasta una pieza con soportes." })}
            {numField("round_to", "Redondear el precio a", { leading: "$", hint: "Siempre hacia arriba. 0 = centavos." })}
          </CardBody>
        </Card>

        {/* Calidades */}
        <Card>
          <CardHeader
            title="Calidades"
            description="Altura de capa, paredes y cuántos gramos por hora saca una impresora. El multiplicador encarece las finas."
            actions={
              <Button size="sm" icon={<Plus aria-hidden />} onClick={addQuality} disabled={values.qualities.length >= 20}>
                Calidad
              </Button>
            }
          />
          <div className="adm-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-adm-table-head text-xs text-adm-fg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Nombre</th>
                  <th className="px-2 py-2 text-left font-medium">Capa</th>
                  <th className="px-2 py-2 text-left font-medium">Paredes</th>
                  <th className="px-2 py-2 text-left font-medium">Caudal</th>
                  <th className="px-2 py-2 text-left font-medium">× precio</th>
                  <th className="px-2 py-2 text-left font-medium">Activa</th>
                  <th className="w-10 px-2 py-2">
                    <span className="sr-only">Borrar</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-adm-border">
                {values.qualities.map((q, i) => {
                  const rowErr =
                    err(`qualities.${i}.name`) ??
                    err(`qualities.${i}.code`) ??
                    err(`qualities.${i}.layer_height`) ??
                    err(`qualities.${i}.wall_mm`) ??
                    err(`qualities.${i}.throughput_g_h`) ??
                    err(`qualities.${i}.price_multiplier`);
                  return (
                    <tr key={q.key} className="align-top">
                      <td className="px-4 py-2">
                        <Input
                          size="sm"
                          aria-label="Nombre de la calidad"
                          value={q.name}
                          placeholder="Ej. Fina 0,16"
                          invalid={Boolean(err(`qualities.${i}.name`))}
                          onChange={(e) => setQ(i, "name", e.target.value)}
                          maxLength={40}
                        />
                        {rowErr ? <p className="mt-1 text-xs text-adm-danger">{rowErr}</p> : null}
                      </td>
                      <td className="px-2 py-2">
                        <Input size="sm" aria-label="Altura de capa" className="w-20" inputMode="decimal" value={q.layer_height} onChange={(e) => setQ(i, "layer_height", e.target.value)} trailing="mm" invalid={Boolean(err(`qualities.${i}.layer_height`))} />
                      </td>
                      <td className="px-2 py-2">
                        <Input size="sm" aria-label="Espesor de paredes" className="w-20" inputMode="decimal" value={q.wall_mm} onChange={(e) => setQ(i, "wall_mm", e.target.value)} trailing="mm" invalid={Boolean(err(`qualities.${i}.wall_mm`))} />
                      </td>
                      <td className="px-2 py-2">
                        <Input size="sm" aria-label="Gramos por hora" className="w-24" inputMode="decimal" value={q.throughput_g_h} onChange={(e) => setQ(i, "throughput_g_h", e.target.value)} trailing="g/h" invalid={Boolean(err(`qualities.${i}.throughput_g_h`))} />
                      </td>
                      <td className="px-2 py-2">
                        <Input size="sm" aria-label="Multiplicador de precio" className="w-16" inputMode="decimal" value={q.price_multiplier} onChange={(e) => setQ(i, "price_multiplier", e.target.value)} invalid={Boolean(err(`qualities.${i}.price_multiplier`))} />
                      </td>
                      <td className="px-2 py-3">
                        <Switch aria-label={`${q.name || "Calidad"} activa`} checked={q.is_active} onCheckedChange={(v) => setQ(i, "is_active", v)} />
                      </td>
                      <td className="px-2 py-2">
                        <Button variant="ghost" size="icon-sm" aria-label={`Borrar ${q.name || "calidad"}`} onClick={() => removeQuality(q)}>
                          <Trash2 aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {values.qualities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-adm-fg-muted">
                      Sin calidades: el cotizador necesita al menos una. Agregá «Estándar 0,20» con unos 15 g/h para arrancar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="border-t border-adm-border px-4 py-2.5 text-xs text-adm-fg-muted">
            El caudal es un promedio real (no el máximo del fabricante): una A1 con PLA a 0,20 saca unos 15 g/h. La calibración lo ajusta sola con los trabajos terminados.
          </p>
        </Card>

        {/* Calendario */}
        <Card>
          <CardHeader title="Calendario" description="Para calcular la fecha de entrega que ve el cliente." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            {numField("daily_print_hours", "Horas de impresión por día", { trailing: "h", hint: "Por impresora, contando la noche." })}
            {numField("post_process_days", "Días de post-proceso", { trailing: "días" })}
            {numField("buffer_days", "Colchón", { trailing: "días", hint: "Margen por si algo falla." })}
            <fieldset className="sm:col-span-3">
              <legend className="mb-1.5 text-[13px] font-medium text-adm-fg">Días de despacho</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_DAYS.map((d) => {
                  const on = s.working_days.includes(d.iso);
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      aria-pressed={on}
                      aria-label={d.long}
                      title={d.long}
                      onClick={() =>
                        setS(
                          "working_days",
                          on ? s.working_days.filter((x) => x !== d.iso) : [...s.working_days, d.iso].sort((a, b) => a - b),
                        )
                      }
                      className={cn(
                        "size-10 rounded-adm border text-sm font-medium transition-colors sm:size-9",
                        on
                          ? "border-adm-accent bg-adm-accent text-adm-accent-fg"
                          : "border-adm-input-border bg-adm-surface text-adm-fg-muted hover:text-adm-fg",
                      )}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
              <p className={cn("mt-1.5 text-xs", err("settings.working_days") ? "text-adm-danger" : "text-adm-fg-muted")}>
                {err("settings.working_days") ?? "Las impresoras imprimen todos los días; esto es cuándo entregás y post-procesás."}
              </p>
            </fieldset>
          </CardBody>
        </Card>

        {/* Costos */}
        <Card>
          <CardHeader title="Costos" description="No se muestran en la tienda: sirven para saber cuánto ganás en cada trabajo." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {numField("kwh_price", "Precio del kWh", { leading: "$", hint: "Mirá tu factura de luz (con impuestos)." })}
            {numField("labor_hour_cost", "Hora de post-proceso", { leading: "$", trailing: "/h", hint: "Lo que vale tu hora (o la de quien lija)." })}
          </CardBody>
        </Card>

        {/* Cotizador */}
        <Card>
          <CardHeader title="Cotizador en la tienda" description="Lo que ve el cliente en /impresion-3d." />
          <CardBody className="space-y-4">
            <Switch
              label="Cotizador visible"
              description="Si lo apagás, la página de la tienda deja de existir; lo demás sigue andando."
              checked={s.enabled}
              onCheckedChange={(v) => setS("enabled", v)}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {numField("max_file_mb", "Archivo máximo", { trailing: "MB", hint: "Hasta 100 MB." })}
              {numField("quote_valid_days", "Validez de la cotización", { trailing: "días" })}
              {numField("max_auto_hours", "Revisión manual desde", { trailing: "h", hint: "Piezas más largas las mirás vos." })}
            </div>
            <Field
              label="Texto de bienvenida"
              hint="Aparece arriba del cotizador. Podés usar **negrita** y listas."
              error={err("settings.intro_md")}
              aside={`${s.intro_md.length}/4000`}
            >
              <Textarea
                rows={4}
                value={s.intro_md}
                onChange={(e) => setS("intro_md", e.target.value)}
                maxLength={4000}
                placeholder="Subí tu STL y te pasamos el precio al toque. Imprimimos en PLA y PETG; retiro por el taller o envío."
              />
            </Field>
          </CardBody>
        </Card>

        {/* Calibración */}
        <Card>
          <CardHeader
            title="Calibración"
            description="Cada trabajo terminado compara lo real con lo estimado y ajusta gramos y tiempo por material × calidad (mediana de los últimos 20, desde 3 trabajos)."
            actions={
              calibration.length ? (
                <Button size="sm" icon={<RotateCcw aria-hidden />} onClick={() => setResetAll(true)}>
                  Resetear todo
                </Button>
              ) : null
            }
          />
          {activeMaterials.length === 0 || savedQualities.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-adm-fg-muted">Cargá materiales y calidades para ver la calibración.</p>
          ) : (
            <div className="adm-scroll overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead className="bg-adm-table-head text-xs text-adm-fg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Material</th>
                    <th className="px-2 py-2 text-left font-medium">Calidad</th>
                    <th className="px-2 py-2 text-right font-medium">Gramos</th>
                    <th className="px-2 py-2 text-right font-medium">Tiempo</th>
                    <th className="px-2 py-2 text-left font-medium">Trabajos</th>
                    <th className="w-10 px-2 py-2">
                      <span className="sr-only">Resetear</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="tnum divide-y divide-adm-border">
                  {activeMaterials.flatMap((m) =>
                    savedQualities.map((q) => {
                      const row = calibration.find((c) => c.material_id === m.id && c.quality_id === q.id);
                      return (
                        <tr key={`${m.id}:${q.id}`}>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <Swatch hex={m.colors[0]?.hex ?? "#999999"} size={10} />
                              {m.name}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-adm-fg-muted">{q.name}</td>
                          <td className="px-2 py-2 text-right">
                            <Factor value={row?.grams_factor ?? 1} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <Factor value={row?.time_factor ?? 1} />
                          </td>
                          <td className="px-2 py-2">
                            {!row || row.samples === 0 ? (
                              <span className="text-adm-fg-muted">Sin datos</span>
                            ) : row.samples < 3 ? (
                              <Badge tone="neutral">Aprendiendo {row.samples}/3</Badge>
                            ) : (
                              <Badge tone="green">{formatNumber(row.samples)} trabajos</Badge>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {row ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Resetear ${m.name} ${q.name}`}
                                title="Volver a ×1"
                                onClick={() => void reset({ material_id: m.id, quality_id: q.id })}
                              >
                                <RotateCcw aria-hidden />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <PriceSimulator
        className="lg:sticky lg:top-4"
        settings={priceSettings}
        qualities={liveQualities}
        materials={materials}
        calibration={cal}
        printers={printers}
        kwhPrice={kwh}
        laborHourCost={num(s.labor_hour_cost)}
      />

      <div className="lg:col-span-2">
        <SaveBar visible={dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} />
      </div>

      <ConfirmDialog
        open={Boolean(qualityToDelete)}
        onOpenChange={(o) => !o && setQualityToDelete(null)}
        title={qualityToDelete ? `¿Borrar «${qualityToDelete.name}»?` : ""}
        description="Si ya se usó en cotizaciones o trabajos no se puede: desactivala y deja de ofrecerse."
        confirmLabel="Borrar calidad"
        destructive
        onConfirm={confirmDeleteQuality}
      />
      <ConfirmDialog
        open={resetAll}
        onOpenChange={setResetAll}
        title="¿Resetear toda la calibración?"
        description="Todos los factores vuelven a ×1 y se empieza a aprender de nuevo con los próximos trabajos."
        confirmLabel="Resetear calibración"
        destructive
        onConfirm={() => reset(null)}
      />
    </div>
  );
}

/** ×1,08 — resaltado si se aleja más de 5 % de lo estimado. */
function Factor({ value }: { value: number }) {
  const off = Math.abs(value - 1) > 0.05;
  return (
    <span className={cn(off ? "font-medium text-adm-accent-2-ink" : "text-adm-fg-muted")}>
      ×{formatNumber(value, "es-AR", 2)}
    </span>
  );
}
