"use client";

import { Package, Timer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ProductPicker } from "@/components/admin/products/ProductPicker";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { AdminCalibration, AdminProductSpec, AdminQuality } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent } from "@/lib/money";
import { calibrationFor } from "@/lib/print3d";

import { listSpecVariants, saveProductSpec, type SpecVariantOption } from "@/app/admin/(panel)/taller-3d/productos/actions";

import { estimateMinutes } from "./math";
import { formatDuration } from "./PriceSimulator";
import { specUnitCost, type SpecCostContext } from "./spec-cost";
import { Swatch } from "./Swatch";

export type SpecDrawerTarget = { mode: "new" } | { mode: "edit"; spec: AdminProductSpec };

interface FormValues {
  product_id: string;
  product_name: string;
  variant_id: string;
  material_id: string;
  color_id: string;
  quality_id: string;
  grams_per_unit: string;
  minutes_per_unit: string;
  units_per_plate: string;
  post_minutes: string;
  made_to_order: boolean;
}

const str = (n: number) => String(n).replace(".", ",");
const toNum = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : Number.NaN;
};

function valuesFor(target: SpecDrawerTarget | null, ctx: SpecCostContext, qualities: AdminQuality[]): FormValues {
  if (target?.mode === "edit") {
    const s = target.spec;
    return {
      product_id: s.product_id,
      product_name: s.product_name,
      variant_id: s.variant_id ?? "",
      material_id: s.material_id,
      color_id: s.color_id ?? "",
      quality_id: s.quality_id,
      grams_per_unit: str(s.grams_per_unit),
      minutes_per_unit: str(s.minutes_per_unit),
      units_per_plate: String(s.units_per_plate),
      post_minutes: str(s.post_minutes),
      made_to_order: s.made_to_order,
    };
  }
  const material = ctx.materials.find((m) => m.is_active) ?? ctx.materials[0];
  const quality = qualities.find((q) => q.code === "standard") ?? qualities.find((q) => q.is_active) ?? qualities[0];
  return {
    product_id: "",
    product_name: "",
    variant_id: "",
    material_id: material?.id ?? "",
    color_id: "",
    quality_id: quality?.id ?? "",
    grams_per_unit: "",
    minutes_per_unit: "",
    units_per_plate: "1",
    post_minutes: "0",
    made_to_order: true,
  };
}

/** Ficha de impresión de un producto del catálogo, con costo y margen en vivo. */
export function ProductSpecDrawer({
  target,
  ctx,
  qualities,
  calibration,
  takenProductIds,
  onOpenChange,
  onDelete,
}: {
  target: SpecDrawerTarget | null;
  ctx: SpecCostContext;
  qualities: AdminQuality[];
  calibration: AdminCalibration[];
  takenProductIds: string[];
  onOpenChange: (open: boolean) => void;
  onDelete: (spec: AdminProductSpec) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => valuesFor(target, ctx, qualities));
  const [lastTarget, setLastTarget] = useState(target);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loaded, setLoaded] = useState<{ productId: string; variants: SpecVariantOption[] } | null>(null);

  if (target !== lastTarget) {
    setLastTarget(target);
    setValues(valuesFor(target, ctx, qualities));
    setErrors({});
  }

  const editing = target?.mode === "edit" ? target.spec : null;
  const productId = values.product_id;

  const variants = loaded && loaded.productId === productId ? loaded.variants : [];
  const loadingVariants = Boolean(productId) && loaded?.productId !== productId;

  useEffect(() => {
    if (!productId) return;
    let alive = true;
    void listSpecVariants(productId).then((res) => {
      if (!alive) return;
      setLoaded({ productId, variants: res.ok ? res.data.variants : [] });
    });
    return () => {
      alive = false;
    };
  }, [productId]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const material = ctx.materials.find((m) => m.id === values.material_id);
  const quality = qualities.find((q) => q.id === values.quality_id);
  const grams = toNum(values.grams_per_unit);
  const minutes = toNum(values.minutes_per_unit);
  const post = toNum(values.post_minutes);

  const estimate = () => {
    if (!material || !quality || !(grams > 0)) {
      toast.error("Cargá los gramos, el material y la calidad para estimar.");
      return;
    }
    const cal = calibrationFor(calibration, material.id, quality.id);
    set("minutes_per_unit", str(estimateMinutes(grams, quality, material, cal.time_factor)));
  };

  const cost =
    grams > 0 && minutes > 0
      ? specUnitCost(
          {
            material_id: values.material_id,
            color_id: values.color_id || null,
            grams_per_unit: grams,
            minutes_per_unit: minutes,
            post_minutes: post > 0 ? post : 0,
          },
          ctx,
        )
      : null;
  const variant = variants.find((v) => v.id === values.variant_id);
  const price = variant ? variant.price : variants.length ? Math.min(...variants.map((v) => v.price)) : (editing?.price ?? null);
  const margin = cost && price !== null ? price - cost.total : null;

  const submit = async () => {
    setSaving(true);
    const res = await saveProductSpec({ id: editing?.id ?? null, ...values });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Ficha guardada" : "Producto agregado al taller");
    onOpenChange(false);
  };

  return (
    <>
      <Drawer
        open={Boolean(target)}
        onOpenChange={onOpenChange}
        width="w-[min(520px,100vw)]"
        title={editing ? "Ficha de impresión" : "Producto que se imprime"}
        description={editing ? editing.product_name : "Cuánto filamento y tiempo lleva cada unidad."}
        dismissable={!saving && !pickerOpen}
        footer={
          <>
            {editing ? (
              <Button variant="ghost" icon={<Trash2 />} className="mr-auto text-adm-danger hover:text-adm-danger" onClick={() => onDelete(editing)}>
                Quitar
              </Button>
            ) : null}
            <Button onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void submit()} loading={saving} disabled={!values.product_id}>
              Guardar ficha
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
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-adm-fg">Producto</span>
            {values.product_id ? (
              <div className="flex items-center gap-2 rounded-adm border border-adm-border bg-adm-surface-2/60 px-3 py-2">
                <Package className="size-4 shrink-0 text-adm-fg-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{values.product_name}</span>
                {!editing ? (
                  <Button size="sm" variant="link" onClick={() => setPickerOpen(true)}>
                    Cambiar
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button icon={<Package aria-hidden />} onClick={() => setPickerOpen(true)} className="justify-start">
                Elegir un producto del catálogo
              </Button>
            )}
            {errors.product_id ? <p className="text-xs text-adm-danger">{errors.product_id[0]}</p> : null}
          </div>

          {values.product_id && (variants.length > 1 || values.variant_id) ? (
            <Field label="Variante" hint="Dejala en «Todas» si todas se imprimen igual." error={errors.variant_id}>
              <Select value={values.variant_id} onChange={(e) => set("variant_id", e.target.value)} disabled={loadingVariants}>
                <option value="">Todas las variantes</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} · {formatMoney(v.price)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Material" error={errors.material_id}>
              <Select
                value={values.material_id}
                onChange={(e) => {
                  set("material_id", e.target.value);
                  set("color_id", "");
                }}
              >
                {ctx.materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.is_active ? "" : " (archivado)"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Calidad" error={errors.quality_id}>
              <Select value={values.quality_id} onChange={(e) => set("quality_id", e.target.value)}>
                {qualities.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {material && material.colors.length ? (
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-adm-fg">Color</legend>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={!values.color_id}
                  onClick={() => set("color_id", "")}
                  className={cn(
                    "h-8 rounded-adm border px-2.5 text-xs",
                    !values.color_id ? "border-adm-link bg-adm-accent-soft text-adm-link" : "border-adm-border text-adm-fg-muted hover:text-adm-fg",
                  )}
                >
                  El que pida el cliente
                </button>
                {material.colors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={values.color_id === c.id}
                    onClick={() => set("color_id", c.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-adm border px-2 text-xs",
                      values.color_id === c.id
                        ? "border-adm-link bg-adm-accent-soft text-adm-link"
                        : "border-adm-border text-adm-fg-muted hover:text-adm-fg",
                    )}
                  >
                    <Swatch hex={c.hex} size={12} muted={!c.is_active} />
                    {c.name}
                  </button>
                ))}
              </div>
              {errors.color_id ? <p className="mt-1 text-xs text-adm-danger">{errors.color_id[0]}</p> : null}
            </fieldset>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Gramos por unidad" hint="Los que te da el laminador." error={errors.grams_per_unit}>
              <Input inputMode="decimal" value={values.grams_per_unit} onChange={(e) => set("grams_per_unit", e.target.value)} trailing="g" />
            </Field>
            <Field
              label="Minutos por unidad"
              hint={minutes > 0 ? formatDuration(minutes) : "Tiempo de máquina de una pieza."}
              error={errors.minutes_per_unit}
            >
              <Input inputMode="decimal" value={values.minutes_per_unit} onChange={(e) => set("minutes_per_unit", e.target.value)} trailing="min" />
            </Field>
          </div>
          <Button size="sm" variant="link" icon={<Timer aria-hidden />} onClick={estimate} className="-mt-2">
            Estimar minutos con la calidad
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Piezas por plato" hint="Cuántas entran en una tanda." error={errors.units_per_plate}>
              <Input inputMode="numeric" value={values.units_per_plate} onChange={(e) => set("units_per_plate", e.target.value)} trailing="u." />
            </Field>
            <Field label="Post-proceso por unidad" error={errors.post_minutes}>
              <Input inputMode="decimal" value={values.post_minutes} onChange={(e) => set("post_minutes", e.target.value)} trailing="min" />
            </Field>
          </div>

          <Switch
            label="Se imprime a pedido"
            description="La ficha del producto muestra «Se imprime a pedido · listo aprox. el …»."
            checked={values.made_to_order}
            onCheckedChange={(v) => set("made_to_order", v)}
          />

          {cost ? (
            <div className="tnum rounded-adm bg-adm-surface-2 px-3 py-2.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-adm-fg-muted">Te cuesta por unidad</span>
                <strong className="font-semibold">{formatMoney(cost.total)}</strong>
              </div>
              <p className="mt-0.5 text-xs text-adm-fg-muted">
                Filamento {formatMoney(cost.material)} · luz {formatMoney(cost.energy)} · amortización {formatMoney(cost.amortization)}
                {cost.labor ? ` · post-proceso ${formatMoney(cost.labor)}` : ""}
              </p>
              {price !== null && margin !== null ? (
                <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-adm-border pt-1.5">
                  <span className="text-adm-fg-muted">Lo vendés a {formatMoney(price)}: ganás</span>
                  <strong className={cn("font-semibold", margin < 0 ? "text-adm-danger" : "text-adm-success")}>
                    {formatMoney(margin)}
                    {price > 0 ? <span className="ml-1 text-xs font-normal text-adm-fg-muted">{formatPercent(Math.round((margin / price) * 100))}</span> : null}
                  </strong>
                </div>
              ) : null}
              {cost.incomplete ? <p className="mt-1 text-xs text-adm-fg-muted">Sin costo de bobinas cargado: el filamento cuenta $ 0.</p> : null}
            </div>
          ) : null}
        </form>
      </Drawer>

      <ProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Elegí el producto"
        description="Los que ya tienen ficha para todas sus variantes no aparecen."
        excludeIds={takenProductIds}
        onPick={([p]) => {
          if (!p) return;
          setValues((v) => ({ ...v, product_id: p.id, product_name: p.name, variant_id: "" }));
          setErrors((e) => ({ ...e, product_id: undefined }));
        }}
      />
    </>
  );
}
