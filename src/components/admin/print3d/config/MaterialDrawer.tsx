"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { AdminMaterial } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { MATERIAL_TYPES, type MaterialType } from "@/lib/print3d/types";

import { saveMaterial } from "@/app/admin/(panel)/taller-3d/filamento/actions";

import { suggestedPricePerGram } from "./math";
import { COMMON_FILAMENT_COLORS, MATERIAL_DEFAULTS } from "./presets";
import { Swatch } from "./Swatch";

export type MaterialDrawerTarget = { mode: "new" } | { mode: "edit"; material: AdminMaterial };

interface ColorRow {
  /** Clave local estable (id real o temporal). */
  key: string;
  id: string | null;
  name: string;
  hex: string;
  is_active: boolean;
  grams: number;
}

interface FormValues {
  type: MaterialType;
  name: string;
  brand: string;
  density: string;
  price_per_gram: string;
  speed_factor: string;
  is_active: boolean;
  colors: ColorRow[];
}

const str = (n: number) => String(n).replace(".", ",");
const toNum = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : Number.NaN;
};

let tmp = 0;
const tempKey = () => `new-${++tmp}`;

function valuesFor(target: MaterialDrawerTarget | null): FormValues {
  if (target?.mode === "edit") {
    const m = target.material;
    return {
      type: m.type,
      name: m.name,
      brand: m.brand ?? "",
      density: str(m.density),
      price_per_gram: str(m.price_per_gram),
      speed_factor: str(m.speed_factor),
      is_active: m.is_active,
      colors: m.colors.map((c) => ({ key: c.id, id: c.id, name: c.name, hex: c.hex, is_active: c.is_active, grams: c.grams })),
    };
  }
  return {
    type: "PLA",
    name: "",
    brand: "",
    density: str(MATERIAL_DEFAULTS.PLA.density),
    price_per_gram: "",
    speed_factor: str(MATERIAL_DEFAULTS.PLA.speed_factor),
    is_active: true,
    colors: COMMON_FILAMENT_COLORS.slice(0, 2).map((c) => ({ key: tempKey(), id: null, ...c, is_active: true, grams: 0 })),
  };
}

/** Alta/edición de un material con sus colores como swatches editables. */
export function MaterialDrawer({
  target,
  onOpenChange,
  onDeleteColor,
  onDeleteMaterial,
}: {
  target: MaterialDrawerTarget | null;
  onOpenChange: (open: boolean) => void;
  /** Borra un color YA guardado (con confirmación afuera). Devuelve true si se borró. */
  onDeleteColor: (color: { id: string; name: string }) => Promise<boolean>;
  onDeleteMaterial: (material: AdminMaterial) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => valuesFor(target));
  const [lastTarget, setLastTarget] = useState(target);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [margin, setMargin] = useState("3");

  if (target !== lastTarget) {
    setLastTarget(target);
    setValues(valuesFor(target));
    setErrors({});
  }

  const editing = target?.mode === "edit" ? target.material : null;
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const changeType = (type: MaterialType) => {
    setValues((v) => {
      const prev = MATERIAL_DEFAULTS[v.type];
      const next = MATERIAL_DEFAULTS[type];
      // Si densidad/velocidad seguían en el default del tipo anterior, se actualizan.
      const density = toNum(v.density) === prev.density || !v.density ? str(next.density) : v.density;
      const speed = toNum(v.speed_factor) === prev.speed_factor || !v.speed_factor ? str(next.speed_factor) : v.speed_factor;
      const autoName = !v.name.trim() || v.name.trim() === v.type;
      return { ...v, type, density, speed_factor: speed, name: autoName ? type : v.name };
    });
  };

  const setColor = (key: string, patch: Partial<ColorRow>) =>
    setValues((v) => ({ ...v, colors: v.colors.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));

  const addColor = (preset?: { name: string; hex: string }) =>
    setValues((v) => ({
      ...v,
      colors: [...v.colors, { key: tempKey(), id: null, name: preset?.name ?? "", hex: preset?.hex ?? "#999999", is_active: true, grams: 0 }],
    }));

  const removeColor = async (row: ColorRow) => {
    if (row.id) {
      const done = await onDeleteColor({ id: row.id, name: row.name });
      if (!done) return;
    }
    setValues((v) => ({ ...v, colors: v.colors.filter((c) => c.key !== row.key) }));
  };

  const usedNames = new Set(values.colors.map((c) => c.name.trim().toLowerCase()));
  const quickColors = COMMON_FILAMENT_COLORS.filter((c) => !usedNames.has(c.name.toLowerCase()));

  const avg = editing?.avg_cost_per_gram ?? null;
  const marginNum = toNum(margin);
  const suggestion = avg !== null && marginNum > 0 ? suggestedPricePerGram(avg, marginNum) : null;
  const price = toNum(values.price_per_gram);

  const submit = async () => {
    setSaving(true);
    const res = await saveMaterial(editing?.id ?? null, {
      ...values,
      colors: values.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, is_active: c.is_active })),
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Material guardado" : "Material creado");
    onOpenChange(false);
  };

  return (
    <Drawer
      open={Boolean(target)}
      onOpenChange={onOpenChange}
      width="w-[min(560px,100vw)]"
      title={editing ? `Editar ${editing.name}` : "Nuevo material"}
      description={MATERIAL_DEFAULTS[values.type].hint}
      dismissable={!saving}
      footer={
        <>
          {editing ? (
            <Button
              variant="ghost"
              icon={<Trash2 />}
              className="mr-auto text-adm-danger hover:text-adm-danger"
              onClick={() => onDeleteMaterial(editing)}
            >
              Borrar
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            {editing ? "Guardar" : "Crear material"}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Tipo" error={errors.type}>
            <Select value={values.type} onChange={(e) => changeType(e.target.value as MaterialType)}>
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nombre" required hint="Así lo ve el cliente: «PLA», «PLA Silk», «PETG»." error={errors.name}>
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
          </Field>
        </div>
        <Field label="Marca" hint="Opcional: Grilon3, Printalot, Bambu…" error={errors.brand}>
          <Input value={values.brand} onChange={(e) => set("brand", e.target.value)} maxLength={40} />
        </Field>

        <div className="rounded-adm border border-adm-border bg-adm-surface-2/60 p-3">
          <Field
            label="Precio de venta por gramo"
            required
            hint="Lo que cobrás por cada gramo de pieza, antes de sumar horas de máquina."
            error={errors.price_per_gram}
          >
            <Input
              inputMode="decimal"
              value={values.price_per_gram}
              onChange={(e) => set("price_per_gram", e.target.value)}
              leading="$"
              trailing="/g"
            />
          </Field>
          {avg !== null ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-adm-fg">
              <span className="tnum">
                Tus bobinas te cuestan <strong className="font-semibold">{formatMoney(avg * 1000)}/kg</strong> ×
              </span>
              <Input
                aria-label="Margen"
                inputMode="decimal"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                size="sm"
                className="w-16"
              />
              <span className="tnum">
                = <strong className="font-semibold">{suggestion !== null ? `${formatMoney(suggestion)}/g` : "—"}</strong>
              </span>
              {suggestion !== null && suggestion !== price ? (
                <Button size="sm" variant="link" onClick={() => set("price_per_gram", str(suggestion))}>
                  Usar este precio
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-adm-fg-muted">Cuando cargues bobinas con su costo te sugerimos un precio según tu margen.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Densidad" hint="g/cm³ del fabricante." error={errors.density}>
            <Input inputMode="decimal" value={values.density} onChange={(e) => set("density", e.target.value)} trailing="g/cm³" />
          </Field>
          <Field label="Factor de velocidad" hint="1 = normal. TPU ≈ 0,5: imprime a la mitad." error={errors.speed_factor}>
            <Input inputMode="decimal" value={values.speed_factor} onChange={(e) => set("speed_factor", e.target.value)} trailing="×" />
          </Field>
        </div>

        <Switch
          label="Se ofrece en el cotizador"
          description="Si lo archivás, deja de aparecer en la tienda; el historial queda."
          checked={values.is_active}
          onCheckedChange={(v) => set("is_active", v)}
        />

        <div className="border-t border-adm-border pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Colores</h3>
            <span className="tnum text-xs text-adm-fg-muted">{values.colors.length}</span>
          </div>
          {errors.colors ? <p className="mt-1 text-xs text-adm-danger">{errors.colors[0]}</p> : null}
          <ul className="mt-2 divide-y divide-adm-border rounded-adm border border-adm-border">
            {values.colors.map((c, i) => {
              const nameErr = errors[`colors.${i}.name`]?.[0] ?? errors[`colors.${i}.hex`]?.[0];
              return (
                <li key={c.key} className="px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex shrink-0 cursor-pointer" title="Cambiar color">
                      <Swatch hex={c.hex} size={28} muted={!c.is_active} />
                      <input
                        type="color"
                        value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#999999"}
                        onChange={(e) => setColor(c.key, { hex: e.target.value.toUpperCase() })}
                        aria-label={`Color de ${c.name || "este color"}`}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                    <Input
                      size="sm"
                      value={c.name}
                      placeholder="Nombre del color"
                      aria-label="Nombre del color"
                      invalid={Boolean(nameErr)}
                      onChange={(e) => setColor(c.key, { name: e.target.value })}
                      maxLength={40}
                      className="min-w-0 flex-1"
                    />
                    <Input
                      size="sm"
                      value={c.hex}
                      aria-label="Código hex"
                      onChange={(e) => setColor(c.key, { hex: e.target.value.trim().toUpperCase() })}
                      maxLength={7}
                      className="hidden w-24 font-mono text-xs sm:block"
                    />
                    <Switch
                      aria-label={c.is_active ? `Desactivar ${c.name}` : `Activar ${c.name}`}
                      checked={c.is_active}
                      onCheckedChange={(v) => setColor(c.key, { is_active: v })}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${c.name || "color"}`}
                      onClick={() => void removeColor(c)}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                  {nameErr ? <p className="mt-1 pl-9 text-xs text-adm-danger">{nameErr}</p> : null}
                </li>
              );
            })}
            {values.colors.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-adm-fg-muted">Sin colores: agregá al menos uno para poder cargar bobinas.</li>
            ) : null}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button size="sm" icon={<Plus aria-hidden />} onClick={() => addColor()}>
              Color
            </Button>
            {quickColors.slice(0, 8).map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => addColor(c)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-adm border border-adm-border bg-adm-surface px-2 text-xs text-adm-fg-muted",
                  "hover:border-adm-input-border-hover hover:text-adm-fg",
                )}
              >
                <Swatch hex={c.hex} size={12} />
                {c.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-adm-fg-muted">
            Apagá un color para sacarlo del cotizador sin perder sus bobinas. Los que tienen historial no se pueden borrar.
          </p>
        </div>
      </form>
    </Drawer>
  );
}
