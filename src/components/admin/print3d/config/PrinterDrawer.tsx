"use client";

import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import type { AdminPrinter } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { MATERIAL_TYPES, type MaterialType } from "@/lib/print3d/types";

import { savePrinter } from "@/app/admin/(panel)/taller-3d/impresoras/actions";

import { BedDiagram } from "./BedDiagram";
import { machineHourCost } from "./math";
import { PRINTER_PRESETS, PRINTER_STATUS_LABELS, PRINTER_STATUSES, PRINTER_TINTS, type PrinterStatus } from "./presets";

export type PrinterDrawerTarget = { mode: "new" } | { mode: "edit"; printer: AdminPrinter };

interface FormValues {
  preset: string;
  name: string;
  brand: string;
  model: string;
  bed_x: string;
  bed_y: string;
  bed_z: string;
  nozzle_mm: string;
  materials: MaterialType[];
  watts: string;
  purchase_price: string;
  lifetime_hours: string;
  hours_used: string;
  status: PrinterStatus;
  color: string;
  notes: string;
}

const str = (n: number) => String(n).replace(".", ",");

function valuesFor(target: PrinterDrawerTarget | null, taken: string[]): FormValues {
  if (target?.mode === "edit") {
    const p = target.printer;
    return {
      preset: "",
      name: p.name,
      brand: p.brand ?? "",
      model: p.model ?? "",
      bed_x: str(p.bed[0]),
      bed_y: str(p.bed[1]),
      bed_z: str(p.bed[2]),
      nozzle_mm: str(p.nozzle_mm),
      materials: p.materials,
      watts: str(p.watts),
      purchase_price: str(p.purchase_price),
      lifetime_hours: String(p.lifetime_hours),
      hours_used: str(p.hours_used),
      status: p.status,
      color: p.color,
      notes: p.notes ?? "",
    };
  }
  const color = PRINTER_TINTS.find((t) => !taken.includes(t.toUpperCase())) ?? PRINTER_TINTS[0];
  return {
    preset: "",
    name: "",
    brand: "",
    model: "",
    bed_x: "",
    bed_y: "",
    bed_z: "",
    nozzle_mm: "0,4",
    materials: ["PLA", "PETG"],
    watts: "150",
    purchase_price: "0",
    lifetime_hours: "5000",
    hours_used: "0",
    status: "active",
    color,
    notes: "",
  };
}

const toNum = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export function PrinterDrawer({
  target,
  kwhPrice,
  takenColors,
  onOpenChange,
  onDelete,
}: {
  target: PrinterDrawerTarget | null;
  kwhPrice: number;
  takenColors: string[];
  onOpenChange: (open: boolean) => void;
  onDelete: (printer: AdminPrinter) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => valuesFor(target, takenColors));
  const [lastTarget, setLastTarget] = useState(target);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  if (target !== lastTarget) {
    setLastTarget(target);
    setValues(valuesFor(target, takenColors));
    setErrors({});
  }

  const editing = target?.mode === "edit" ? target.printer : null;
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const applyPreset = (id: string) => {
    const preset = PRINTER_PRESETS.find((p) => p.id === id);
    if (!preset) {
      set("preset", "");
      return;
    }
    setValues((v) => {
      const prevPreset = PRINTER_PRESETS.find((p) => p.id === v.preset);
      const autoName = !v.name.trim() || (prevPreset && v.name === `${prevPreset.brand} ${prevPreset.model}`);
      return {
        ...v,
        preset: id,
        name: autoName ? `${preset.brand} ${preset.model}` : v.name,
        brand: preset.brand,
        model: preset.model,
        bed_x: String(preset.bed[0]),
        bed_y: String(preset.bed[1]),
        bed_z: String(preset.bed[2]),
        watts: String(preset.watts),
        materials: preset.materials,
      };
    });
    setErrors({});
  };

  const toggleMaterial = (m: MaterialType) =>
    set("materials", values.materials.includes(m) ? values.materials.filter((x) => x !== m) : [...values.materials, m]);

  const bed: [number, number, number] = [toNum(values.bed_x), toNum(values.bed_y), toNum(values.bed_z)];
  const hour = machineHourCost(
    { watts: toNum(values.watts), purchase_price: toNum(values.purchase_price), lifetime_hours: toNum(values.lifetime_hours) || 1 },
    kwhPrice,
  );

  const submit = async () => {
    setSaving(true);
    // `preset` es sólo de la UI: el schema lo descarta.
    const res = await savePrinter(editing?.id ?? null, values);
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Impresora guardada" : "Impresora agregada");
    onOpenChange(false);
  };

  return (
    <Drawer
      open={Boolean(target)}
      onOpenChange={onOpenChange}
      width="w-[min(560px,100vw)]"
      title={editing ? `Editar ${editing.name}` : "Nueva impresora"}
      description={editing ? [editing.brand, editing.model].filter(Boolean).join(" ") || undefined : "Elegí un modelo y ajustá lo que haga falta."}
      dismissable={!saving}
      footer={
        <>
          {editing ? (
            <Button variant="ghost" icon={<Trash2 />} className="mr-auto text-adm-danger hover:text-adm-danger" onClick={() => onDelete(editing)}>
              Borrar
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            {editing ? "Guardar" : "Agregar impresora"}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-5 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-adm-fg">Modelo</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {PRINTER_PRESETS.map((p) => {
              const active = values.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => applyPreset(active ? "" : p.id)}
                  className={cn(
                    "flex min-h-11 flex-col items-start justify-center rounded-adm border px-2.5 py-1.5 text-left transition-colors",
                    active
                      ? "border-adm-link bg-adm-accent-soft"
                      : "border-adm-border bg-adm-surface hover:border-adm-input-border-hover hover:bg-adm-hover",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-1 text-[13px] font-medium text-adm-fg">
                    {p.model}
                    {active ? <Check className="size-3.5 text-adm-link" aria-hidden /> : null}
                  </span>
                  <span className="tnum text-[11px] text-adm-fg-muted">
                    {p.brand} · {p.bed[0] === p.bed[1] && p.bed[1] === p.bed[2] ? `${p.bed[0]}³` : p.bed.join("×")}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-adm-fg-muted">Autocompleta cama, consumo y materiales. ¿La tuya no está? Cargala a mano abajo.</p>
        </fieldset>

        <Field label="Nombre" required hint="Cómo la llamás en el taller: «A1 de la ventana», «Ender vieja»." error={errors.name}>
          <Input value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marca" error={errors.brand}>
            <Input value={values.brand} onChange={(e) => set("brand", e.target.value)} maxLength={40} />
          </Field>
          <Field label="Modelo" error={errors.model}>
            <Input value={values.model} onChange={(e) => set("model", e.target.value)} maxLength={60} />
          </Field>
        </div>

        <div className="rounded-adm border border-adm-border bg-adm-surface-2/60 p-3">
          <div className="flex items-start gap-3">
            <BedDiagram bed={bed} color={values.color} className="w-24 shrink-0 sm:w-28" />
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
              <Field label="Ancho (X)" error={errors.bed_x}>
                <Input inputMode="decimal" value={values.bed_x} onChange={(e) => set("bed_x", e.target.value)} trailing="mm" />
              </Field>
              <Field label="Fondo (Y)" error={errors.bed_y}>
                <Input inputMode="decimal" value={values.bed_y} onChange={(e) => set("bed_y", e.target.value)} trailing="mm" />
              </Field>
              <Field label="Alto (Z)" error={errors.bed_z}>
                <Input inputMode="decimal" value={values.bed_z} onChange={(e) => set("bed_z", e.target.value)} trailing="mm" />
              </Field>
              <Field label="Boquilla" error={errors.nozzle_mm} className="col-span-3 sm:col-span-1">
                <Input inputMode="decimal" value={values.nozzle_mm} onChange={(e) => set("nozzle_mm", e.target.value)} trailing="mm" />
              </Field>
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-adm-fg">Materiales que imprime</legend>
          <div className="flex flex-wrap gap-1.5">
            {MATERIAL_TYPES.map((m) => {
              const on = values.materials.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleMaterial(m)}
                  className={cn(
                    "h-8 rounded-adm border px-2.5 font-mono text-xs transition-colors",
                    on
                      ? "border-adm-accent bg-adm-accent text-adm-accent-fg"
                      : "border-adm-input-border bg-adm-surface text-adm-fg-muted hover:border-adm-input-border-hover hover:text-adm-fg",
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <p className={cn("mt-1.5 text-xs", errors.materials ? "text-adm-danger" : "text-adm-fg-muted")}>
            {errors.materials?.[0] ?? "El cotizador sólo le asigna piezas de estos materiales."}
          </p>
        </fieldset>

        <div className="border-t border-adm-border pt-4">
          <h3 className="text-sm font-semibold">Costos</h3>
          <p className="mt-0.5 text-xs text-adm-fg-muted">Para saber cuánto te cuesta cada hora de máquina. No se muestran en la tienda.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Consumo promedio" error={errors.watts}>
              <Input inputMode="decimal" value={values.watts} onChange={(e) => set("watts", e.target.value)} trailing="W" />
            </Field>
            <Field label="Te costó" error={errors.purchase_price}>
              <Input inputMode="decimal" value={values.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} leading="$" />
            </Field>
            <Field label="Vida útil" hint="Horas en las que la amortizás." error={errors.lifetime_hours}>
              <Input inputMode="numeric" value={values.lifetime_hours} onChange={(e) => set("lifetime_hours", e.target.value)} trailing="h" />
            </Field>
            <Field label="Horas ya usadas" hint="Se suman solas al terminar trabajos." error={errors.hours_used}>
              <Input inputMode="decimal" value={values.hours_used} onChange={(e) => set("hours_used", e.target.value)} trailing="h" />
            </Field>
          </div>
          <p className="tnum mt-3 rounded-adm bg-adm-surface-2 px-3 py-2 text-[13px] text-adm-fg">
            La hora-máquina te cuesta <strong className="font-semibold">{formatMoney(hour.total)}</strong>
            <span className="text-adm-fg-muted">
              {" "}
              · luz {formatMoney(hour.energy)} + amortización {formatMoney(hour.amortization)}
            </span>
          </p>
        </div>

        <div className="border-t border-adm-border pt-4">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-adm-fg">Tinta en la cola</legend>
            <div className="flex flex-wrap items-center gap-2">
              {PRINTER_TINTS.map((t) => {
                const on = values.color.toUpperCase() === t.toUpperCase();
                return (
                  <button
                    key={t}
                    type="button"
                    aria-label={`Color ${t}`}
                    aria-pressed={on}
                    onClick={() => set("color", t)}
                    className={cn(
                      "size-8 rounded-adm border-2 transition-shadow",
                      on ? "border-adm-fg shadow-[0_0_0_2px_var(--adm-surface)_inset]" : "border-transparent",
                    )}
                    style={{ backgroundColor: t }}
                  />
                );
              })}
              <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-adm-fg-muted">
                Otro
                <input
                  type="color"
                  value={values.color}
                  onChange={(e) => set("color", e.target.value.toUpperCase())}
                  className="h-8 w-10 cursor-pointer rounded-adm border border-adm-input-border bg-adm-surface p-0.5"
                />
              </label>
            </div>
            {errors.color ? <p className="mt-1.5 text-xs text-adm-danger">{errors.color[0]}</p> : null}
          </fieldset>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado" error={errors.status}>
            <Select value={values.status} onChange={(e) => set("status", e.target.value as PrinterStatus)}>
              {PRINTER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PRINTER_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notas" hint="Mantenimiento, mañas, qué boquilla tiene puesta." error={errors.notes}>
          <Textarea rows={3} value={values.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} />
        </Field>
      </form>
    </Drawer>
  );
}
