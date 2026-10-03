"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import type { AdminMaterial } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";

import { addSpools } from "@/app/admin/(panel)/taller-3d/filamento/actions";

import { Swatch } from "./Swatch";

export interface AddSpoolsTarget {
  colorId?: string;
}

const NET_PRESETS = [250, 500, 750, 1000, 3000];

interface FormValues {
  color_id: string;
  count: string;
  net_grams: string;
  brand: string;
  cost: string;
  purchased_at: string;
  notes: string;
}

function todayIso() {
  // Fecha local del navegador (alcanza para "comprada el").
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const toNum = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : Number.NaN;
};

function valuesFor(target: AddSpoolsTarget | null, materials: AdminMaterial[]): FormValues {
  const first = materials.flatMap((m) => m.colors).find((c) => c.is_active);
  const brand = target?.colorId ? (materials.find((m) => m.colors.some((c) => c.id === target.colorId))?.brand ?? "") : "";
  return {
    color_id: target?.colorId ?? first?.id ?? "",
    count: "1",
    net_grams: "1000",
    brand,
    cost: "",
    purchased_at: todayIso(),
    notes: "",
  };
}

/** Cargar N bobinas iguales de un color (una compra). */
export function AddSpoolsDialog({
  target,
  materials,
  onOpenChange,
}: {
  target: AddSpoolsTarget | null;
  materials: AdminMaterial[];
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => valuesFor(target, materials));
  const [lastTarget, setLastTarget] = useState(target);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  if (target !== lastTarget) {
    setLastTarget(target);
    setValues(valuesFor(target, materials));
    setErrors({});
  }

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const color = materials.flatMap((m) => m.colors).find((c) => c.id === values.color_id);
  const count = toNum(values.count);
  const net = toNum(values.net_grams);
  const cost = toNum(values.cost);
  const summaryOk = count > 0 && net > 0;

  const submit = async () => {
    setSaving(true);
    const res = await addSpools({ ...values, cost: values.cost.trim() === "" ? "0" : values.cost.replace(/\./g, "") });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(res.data.count === 1 ? "Bobina cargada" : `${res.data.count} bobinas cargadas`);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={onOpenChange}
      size="lg"
      title="Agregar bobinas"
      description="Cargá una compra: N bobinas iguales del mismo color."
      dismissable={!saving}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving} disabled={!values.color_id}>
            {count > 1 ? `Agregar ${formatNumber(count)} bobinas` : "Agregar bobina"}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Color" required error={errors.color_id}>
          <Select value={values.color_id} onChange={(e) => set("color_id", e.target.value)}>
            {materials.map((m) => (
              <optgroup key={m.id} label={`${m.name}${m.is_active ? "" : " (archivado)"}`}>
                {m.colors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.is_active ? "" : " (inactivo)"}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        {color ? (
          <p className="-mt-2 flex items-center gap-2 text-xs text-adm-fg-muted">
            <Swatch hex={color.hex} size={14} />
            Hoy hay {formatNumber(color.grams)} g de este color en el estante.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[100px_1fr]">
          <Field label="Cantidad" error={errors.count}>
            <Input inputMode="numeric" value={values.count} onChange={(e) => set("count", e.target.value)} trailing="u." />
          </Field>
          <Field label="Neto por bobina" error={errors.net_grams}>
            <Input inputMode="numeric" value={values.net_grams} onChange={(e) => set("net_grams", e.target.value)} trailing="g" />
          </Field>
        </div>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {NET_PRESETS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={net === g}
              onClick={() => set("net_grams", String(g))}
              className={cn(
                "tnum h-7 rounded-adm border px-2 text-xs transition-colors",
                net === g
                  ? "border-adm-link bg-adm-accent-soft text-adm-link"
                  : "border-adm-border bg-adm-surface text-adm-fg-muted hover:text-adm-fg",
              )}
            >
              {g >= 1000 ? `${formatNumber(g / 1000)} kg` : `${g} g`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Costo por bobina" hint="Lo que pagaste por cada una." error={errors.cost}>
            <Input inputMode="decimal" value={values.cost} onChange={(e) => set("cost", e.target.value)} leading="$" placeholder="0" />
          </Field>
          <Field label="Marca" error={errors.brand}>
            <Input value={values.brand} onChange={(e) => set("brand", e.target.value)} maxLength={40} placeholder="Grilon3, Printalot…" />
          </Field>
          <Field label="Comprada el" error={errors.purchased_at}>
            <Input type="date" value={values.purchased_at} onChange={(e) => set("purchased_at", e.target.value)} />
          </Field>
          <Field label="Nota" error={errors.notes}>
            <Input value={values.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} placeholder="Lote, proveedor…" />
          </Field>
        </div>

        {summaryOk ? (
          <p className="tnum rounded-adm bg-adm-surface-2 px-3 py-2 text-[13px] text-adm-fg">
            {formatNumber(count)} × {formatNumber(net)} g = <strong className="font-semibold">{formatNumber((count * net) / 1000, "es-AR", 2)} kg</strong>
            {cost > 0 ? (
              <span className="text-adm-fg-muted">
                {" "}
                · {formatMoney(cost * count)} en total · {formatMoney((cost / net) * 1000)}/kg
              </span>
            ) : null}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
