"use client";

import { ChevronRight, ImageOff, Plus, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { DropdownItem, DropdownMenu } from "@/components/ui/DropdownMenu";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import type { AdminImage } from "@/lib/admin/products";
import {
  buildVariantMatrix,
  cleanOptions,
  countCombinations,
  MAX_OPTIONS,
  MAX_VARIANTS,
  renameOptionKey,
  validateOptions,
} from "@/lib/admin/variant-matrix";

import { ChipsInput } from "./TagsInput";
import { emptyVariant, newKey, parseInteger, type FormOption, type FormVariant } from "./form-state";

type Errors = Record<string, string[] | undefined>;

interface Props {
  options: FormOption[];
  variants: FormVariant[];
  images: AdminImage[];
  errors: Errors;
  onChange: (options: FormOption[], variants: FormVariant[]) => void;
  stockNote: string;
  onStockNote: (note: string) => void;
}

/** `md` en adelante: tabla densa; abajo, tarjetas por variante (la tabla mide 1080 px). */
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

const OPTION_SUGGESTIONS = ["Talle", "Color", "Material", "Tamaño", "Modelo", "Capacidad"];

/** Opciones con el nombre aplicado si el input quedó vacío (evita perder variantes mientras se escribe). */
function effective(options: FormOption[]) {
  return options.map((o) => ({ name: o.name.trim() || o.applied, values: o.values }));
}

function rebuild(options: FormOption[], variants: FormVariant[]): FormVariant[] {
  return buildVariantMatrix(effective(options), variants, (values, template) => ({
    ...emptyVariant(
      template
        ? {
            price: template.price,
            compare_at_price: template.compare_at_price,
            cost: template.cost,
            track_inventory: template.track_inventory,
            allow_backorder: template.allow_backorder,
            low_stock_threshold: template.low_stock_threshold,
            weight_grams: template.weight_grams,
          }
        : undefined,
    ),
    option_values: values,
  }));
}

export function VariantsEditor({ options, variants, images, errors, onChange, stockNote, onStockNote }: Props) {
  const optionErrors = validateOptions(options);
  const hasOptions = cleanOptions(effective(options)).length > 0;
  const stockChanged = variants.some(
    (v) => v.id && v.track_inventory && v.stock_original !== null && parseInteger(v.stock) !== v.stock_original,
  );

  const apply = (nextOptions: FormOption[], baseVariants = variants) => {
    const total = countCombinations(cleanOptions(effective(nextOptions)));
    if (total > MAX_VARIANTS) {
      toast.error(`Serían ${total} variantes. El máximo es ${MAX_VARIANTS}: sacá algún valor.`);
      return;
    }
    onChange(nextOptions, rebuild(nextOptions, baseVariants));
  };

  const renameOption = (index: number, name: string) => {
    const current = options[index];
    const clean = name.trim();
    const collides = options.some((o, i) => i !== index && (o.name.trim() || o.applied).toLowerCase() === clean.toLowerCase());
    if (!clean || collides) {
      // Nombre vacío o repetido: sólo se actualiza el input (el error lo muestra la validación).
      onChange(
        options.map((o, i) => (i === index ? { ...o, name } : o)),
        variants,
      );
      return;
    }
    const base = current.applied ? renameOptionKey(variants, current.applied, clean) : variants;
    apply(
      options.map((o, i) => (i === index ? { ...o, name, applied: clean } : o)),
      base,
    );
  };

  const setValues = (index: number, values: string[]) => apply(options.map((o, i) => (i === index ? { ...o, values } : o)));
  const addOption = (name = "") => apply([...options, { key: newKey("o"), name, applied: name, values: [] }]);
  const removeOption = (index: number) => apply(options.filter((_, i) => i !== index));

  const updateVariant = (key: string, patch: Partial<FormVariant>) =>
    onChange(
      options,
      variants.map((v) => (v.key === key ? { ...v, ...patch } : v)),
    );

  const usedNames = new Set(options.map((o) => o.name.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      {/* Opciones */}
      <div className="space-y-3">
        {options.map((o, i) => (
          <div key={o.key} className="rounded-adm border border-adm-border p-3">
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start">
              <Field label="Opción" error={errors[`options.${i}.name`] ?? (optionErrors[i]?.includes("nombre") || optionErrors[i]?.includes("Ya hay") ? optionErrors[i] : undefined)}>
                <Input
                  value={o.name}
                  onChange={(e) => renameOption(i, e.target.value)}
                  placeholder="Talle, Color…"
                  list="adm-option-names"
                  maxLength={40}
                />
              </Field>
              <Field
                label="Valores"
                hint="Escribí y apretá Enter. Podés pegar varios separados por coma: S, M, L."
                error={
                  errors[`options.${i}.values`] ??
                  (optionErrors[i] && !optionErrors[i].includes("nombre") && !optionErrors[i].includes("Ya hay") ? optionErrors[i] : undefined)
                }
              >
                <ChipsInput value={o.values} onChange={(values) => setValues(i, values)} placeholder="Agregá valores" />
              </Field>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Quitar la opción ${o.name || i + 1}`}
                className="sm:mt-6"
                onClick={() => removeOption(i)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
        <datalist id="adm-option-names">
          {OPTION_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {options.length < MAX_OPTIONS ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" icon={<Plus />} onClick={() => addOption()}>
              {options.length ? "Agregar otra opción" : "Agregar opciones (talle, color…)"}
            </Button>
            {!options.length
              ? OPTION_SUGGESTIONS.slice(0, 2).map((s) => (
                  <Button key={s} size="sm" variant="ghost" onClick={() => addOption(s)} disabled={usedNames.has(s.toLowerCase())}>
                    + {s}
                  </Button>
                ))
              : null}
          </div>
        ) : (
          <p className="text-xs text-adm-fg-muted">Hasta {MAX_OPTIONS} opciones por producto.</p>
        )}
      </div>

      {hasOptions ? (
        <VariantsTable variants={variants} images={images} errors={errors} onUpdate={updateVariant} onChangeAll={(vs) => onChange(options, vs)} />
      ) : (
        <SingleVariantFields variant={variants[0]} errors={errors} onUpdate={(patch) => updateVariant(variants[0].key, patch)} />
      )}
      {errors.variants ? <p className="text-xs text-adm-danger">{errors.variants[0]}</p> : null}

      {stockChanged ? (
        <Field label="Motivo del ajuste de stock" hint="Queda en el historial de movimientos. Si lo dejás vacío se anota «Ajuste desde la ficha del producto».">
          <Input value={stockNote} onChange={(e) => onStockNote(e.target.value)} maxLength={200} placeholder="Ej.: recuento de depósito" />
        </Field>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** ¿Algún dato "avanzado" ya tiene valor (o falló)? Entonces el bloque arranca abierto. */
function hasAdvanced(v: FormVariant) {
  return Boolean(
    v.cost || v.sku || v.barcode || v.weight_grams || v.low_stock_threshold || !v.track_inventory || v.allow_backorder,
  );
}

const ADVANCED_FIELDS = ["cost", "sku", "barcode", "weight_grams", "low_stock_threshold"];

function SingleVariantFields({
  variant: v,
  errors,
  onUpdate,
}: {
  variant: FormVariant;
  errors: Errors;
  onUpdate: (patch: Partial<FormVariant>) => void;
}) {
  const e = (field: string) => errors[`variants.0.${field}`];
  const advancedError = ADVANCED_FIELDS.some((f) => e(f)?.length);
  // Divulgación progresiva: lo diario (precio, tachado, stock) arriba; el resto, en "Más datos".
  const [open, setOpen] = useState(() => hasAdvanced(v));
  const showAdvanced = open || advancedError;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Precio" required error={e("price")}>
          <Input inputMode="decimal" leading="$" value={v.price} onChange={(ev) => onUpdate({ price: ev.target.value })} placeholder="0" />
        </Field>
        <Field
          label="Stock"
          hint={v.id && v.stock_original !== null ? `Actual: ${v.stock_original}. El cambio queda como ajuste.` : v.track_inventory ? undefined : "No controlás el stock."}
          error={e("stock")}
        >
          <Input
            inputMode="numeric"
            value={v.track_inventory ? v.stock : ""}
            disabled={!v.track_inventory}
            placeholder={v.track_inventory ? "0" : "Sin seguimiento"}
            onChange={(ev) => onUpdate({ stock: ev.target.value })}
          />
        </Field>
        <Field label="Precio tachado" hint="El precio anterior, para mostrar la oferta." error={e("compare_at_price")}>
          <Input
            inputMode="decimal"
            leading="$"
            value={v.compare_at_price}
            onChange={(ev) => onUpdate({ compare_at_price: ev.target.value })}
          />
        </Field>
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showAdvanced}
          aria-controls="variant-advanced"
          onClick={() => setOpen(!showAdvanced)}
          className="inline-flex h-8 items-center gap-1.5 rounded-adm px-1 text-[13px] font-medium text-adm-link hover:underline max-md:h-11"
        >
          <ChevronRight className={cn("size-4 transition-transform duration-100", showAdvanced && "rotate-90")} aria-hidden />
          Más datos: costo, SKU, código de barras, peso y control de stock
        </button>
        {showAdvanced ? (
          <div id="variant-advanced" className="mt-3 space-y-4 rounded-adm border border-adm-border bg-adm-surface-2/40 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Costo" hint="No se muestra en la tienda. Sirve para calcular márgenes." error={e("cost")}>
                <Input inputMode="decimal" leading="$" value={v.cost} onChange={(ev) => onUpdate({ cost: ev.target.value })} />
              </Field>
              <Field label="SKU" error={e("sku")}>
                <Input value={v.sku} onChange={(ev) => onUpdate({ sku: ev.target.value })} className="font-mono" maxLength={64} />
              </Field>
              <Field label="Código de barras" error={e("barcode")}>
                <Input value={v.barcode} onChange={(ev) => onUpdate({ barcode: ev.target.value })} className="font-mono" maxLength={64} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Peso (g)" hint="Para calcular envíos." error={e("weight_grams")}>
                <Input inputMode="numeric" value={v.weight_grams} onChange={(ev) => onUpdate({ weight_grams: ev.target.value })} />
              </Field>
              <Field label="Aviso de stock bajo" hint="Vacío = el de la tienda." error={e("low_stock_threshold")}>
                <Input
                  inputMode="numeric"
                  value={v.low_stock_threshold}
                  disabled={!v.track_inventory}
                  onChange={(ev) => onUpdate({ low_stock_threshold: ev.target.value })}
                />
              </Field>
              <div className="space-y-2 sm:pt-6">
                <Checkbox
                  checked={v.track_inventory}
                  onChange={(ev) => onUpdate({ track_inventory: ev.target.checked })}
                  label="Controlar stock"
                />
                <Checkbox
                  checked={v.allow_backorder}
                  disabled={!v.track_inventory}
                  onChange={(ev) => onUpdate({ allow_backorder: ev.target.checked })}
                  label="Vender sin stock"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const cellInput =
  "h-8 pointer-coarse:h-11 pointer-coarse:text-base w-full min-w-0 rounded-adm border border-adm-input-border bg-adm-surface px-2 text-[13px] text-adm-fg placeholder:text-adm-fg-muted/60 hover:border-adm-input-border-hover disabled:bg-adm-surface-2 disabled:text-adm-fg-muted aria-invalid:border-adm-danger";

function VariantsTable({
  variants,
  images,
  errors,
  onUpdate,
  onChangeAll,
}: {
  variants: FormVariant[];
  images: AdminImage[];
  errors: Errors;
  onUpdate: (key: string, patch: Partial<FormVariant>) => void;
  onChangeAll: (variants: FormVariant[]) => void;
}) {
  const desktop = useIsDesktop();
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const err = (i: number, f: string) => errors[`variants.${i}.${f}`]?.[0];
  const imageUrl = new Map(images.map((i) => [i.id, i.url]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-adm bg-adm-surface-2 px-3 py-2">
        <span className="mr-1 self-center text-[13px] font-medium">Aplicar a todas</span>
        <label className="flex items-center gap-1.5 text-[13px] text-adm-fg-muted">
          Precio
          <input
            className={cn(cellInput, "w-28")}
            inputMode="decimal"
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            placeholder="$"
          />
        </label>
        <Button
          size="sm"
          disabled={!bulkPrice.trim()}
          onClick={() => {
            onChangeAll(variants.map((v) => ({ ...v, price: bulkPrice.trim() })));
            setBulkPrice("");
          }}
        >
          Aplicar
        </Button>
        <span aria-hidden className="mx-1 h-5 w-px self-center bg-adm-border" />
        <label className="flex items-center gap-1.5 text-[13px] text-adm-fg-muted">
          Stock
          <input
            className={cn(cellInput, "w-20")}
            inputMode="numeric"
            value={bulkStock}
            onChange={(e) => setBulkStock(e.target.value)}
          />
        </label>
        <Button
          size="sm"
          disabled={!bulkStock.trim()}
          onClick={() => {
            onChangeAll(variants.map((v) => (v.track_inventory ? { ...v, stock: bulkStock.trim() } : v)));
            setBulkStock("");
          }}
        >
          Aplicar
        </Button>
        <span className="tnum ml-auto self-center text-xs text-adm-fg-muted">
          {variants.length} variante{variants.length === 1 ? "" : "s"}
        </span>
      </div>

      {!desktop ? (
        <VariantCards variants={variants} images={images} errors={errors} onUpdate={onUpdate} />
      ) : (
      <div className="adm-scroll overflow-x-auto rounded-adm border border-adm-border">
        <table className="w-full min-w-[1080px] border-collapse text-[13px]">
          <thead className="bg-adm-surface-2 text-xs text-adm-fg-muted">
            <tr className="[&>th]:h-9 [&>th]:border-b [&>th]:border-adm-border [&>th]:px-2 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
              <th className="sticky left-0 z-[1] w-[200px] bg-adm-surface-2">Variante</th>
              <th className="w-28">Precio</th>
              <th className="w-28">Tachado</th>
              <th className="w-24">Costo</th>
              <th className="w-20">Stock</th>
              <th className="w-32">SKU</th>
              <th className="w-32">Cód. de barras</th>
              <th className="w-16" title="Aviso de stock bajo">Umbral</th>
              <th className="w-16">Peso (g)</th>
              <th className="w-16 text-center" title="Controlar stock">Controla</th>
              <th className="w-16 text-center" title="Vender sin stock">Sin stock</th>
              <th className="w-16 text-center">Activa</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={v.key} className={cn("border-b border-adm-border last:border-b-0 [&>td]:px-2 [&>td]:py-1", !v.is_active && "bg-adm-surface-2/50")}>
                <td className="sticky left-0 z-[1] bg-adm-surface">
                  <div className="flex items-center gap-2">
                    <VariantImagePicker
                      images={images}
                      value={v.image_id}
                      url={v.image_id ? (imageUrl.get(v.image_id) ?? null) : null}
                      label={v.title}
                      onChange={(image_id) => onUpdate(v.key, { image_id })}
                    />
                    <div className="min-w-0">
                      <p className={cn("truncate font-medium", !v.is_active && "text-adm-fg-muted")} title={v.title}>
                        {v.title}
                      </p>
                      {!v.id ? <p className="text-[11px] text-adm-fg-muted">Nueva</p> : null}
                      {err(i, "title") ? <p className="text-[11px] text-adm-danger">{err(i, "title")}</p> : null}
                    </div>
                  </div>
                </td>
                <td>
                  <CellInput
                    label={`Precio de ${v.title}`}
                    value={v.price}
                    error={err(i, "price")}
                    inputMode="decimal"
                    onChange={(price) => onUpdate(v.key, { price })}
                  />
                </td>
                <td>
                  <CellInput
                    label={`Precio tachado de ${v.title}`}
                    value={v.compare_at_price}
                    error={err(i, "compare_at_price")}
                    inputMode="decimal"
                    onChange={(compare_at_price) => onUpdate(v.key, { compare_at_price })}
                  />
                </td>
                <td>
                  <CellInput
                    label={`Costo de ${v.title}`}
                    value={v.cost}
                    error={err(i, "cost")}
                    inputMode="decimal"
                    onChange={(cost) => onUpdate(v.key, { cost })}
                  />
                </td>
                <td>
                  <CellInput
                    label={`Stock de ${v.title}`}
                    value={v.track_inventory ? v.stock : ""}
                    disabled={!v.track_inventory}
                    placeholder={v.track_inventory ? "0" : "—"}
                    error={err(i, "stock")}
                    inputMode="numeric"
                    onChange={(stock) => onUpdate(v.key, { stock })}
                  />
                </td>
                <td>
                  <CellInput label={`SKU de ${v.title}`} value={v.sku} error={err(i, "sku")} mono onChange={(sku) => onUpdate(v.key, { sku })} />
                </td>
                <td>
                  <CellInput
                    label={`Código de barras de ${v.title}`}
                    value={v.barcode}
                    error={err(i, "barcode")}
                    mono
                    onChange={(barcode) => onUpdate(v.key, { barcode })}
                  />
                </td>
                <td>
                  <CellInput
                    label={`Umbral de stock bajo de ${v.title}`}
                    value={v.low_stock_threshold}
                    placeholder="—"
                    disabled={!v.track_inventory}
                    error={err(i, "low_stock_threshold")}
                    inputMode="numeric"
                    onChange={(low_stock_threshold) => onUpdate(v.key, { low_stock_threshold })}
                  />
                </td>
                <td>
                  <CellInput
                    label={`Peso de ${v.title}`}
                    value={v.weight_grams}
                    error={err(i, "weight_grams")}
                    inputMode="numeric"
                    onChange={(weight_grams) => onUpdate(v.key, { weight_grams })}
                  />
                </td>
                <td className="text-center">
                  <Checkbox
                    aria-label={`Controlar stock de ${v.title}`}
                    checked={v.track_inventory}
                    onChange={(e) => onUpdate(v.key, { track_inventory: e.target.checked })}
                  />
                </td>
                <td className="text-center">
                  <Checkbox
                    aria-label={`Vender ${v.title} sin stock`}
                    checked={v.allow_backorder}
                    disabled={!v.track_inventory}
                    onChange={(e) => onUpdate(v.key, { allow_backorder: e.target.checked })}
                  />
                </td>
                <td className="text-center">
                  <Switch
                    aria-label={`${v.title} activa`}
                    checked={v.is_active}
                    onCheckedChange={(is_active) => onUpdate(v.key, { is_active })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <p className="text-xs text-adm-fg-muted">
        Las variantes se arman solas con las opciones. Si sacás un valor, se borran sus variantes al guardar. Una variante inactiva no se vende.
      </p>
    </div>
  );
}

const cardInput = "max-md:h-11 max-md:text-base";

/** Una variante como tarjeta (celular): precio y stock a mano, el resto en "Más datos". */
function VariantCards({
  variants,
  images,
  errors,
  onUpdate,
}: {
  variants: FormVariant[];
  images: AdminImage[];
  errors: Errors;
  onUpdate: (key: string, patch: Partial<FormVariant>) => void;
}) {
  const err = (i: number, f: string) => errors[`variants.${i}.${f}`]?.[0];
  const imageUrl = new Map(images.map((img) => [img.id, img.url]));
  return (
    <ul className="space-y-3">
      {variants.map((v, i) => (
        <li key={v.key} className={cn("rounded-adm border border-adm-border p-3", !v.is_active && "bg-adm-surface-2/50")}>
          <div className="flex items-center gap-3">
            <VariantImagePicker
              images={images}
              value={v.image_id}
              url={v.image_id ? (imageUrl.get(v.image_id) ?? null) : null}
              label={v.title}
              onChange={(image_id) => onUpdate(v.key, { image_id })}
              large
            />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-medium", !v.is_active && "text-adm-fg-muted")}>{v.title}</p>
              {!v.id ? <p className="text-xs text-adm-fg-muted">Nueva</p> : null}
              {err(i, "title") ? <p className="text-xs text-adm-danger">{err(i, "title")}</p> : null}
            </div>
            <Switch aria-label={`${v.title} activa`} checked={v.is_active} onCheckedChange={(is_active) => onUpdate(v.key, { is_active })} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Precio" error={err(i, "price")}>
              <Input inputMode="decimal" leading="$" className={cardInput} value={v.price} onChange={(e) => onUpdate(v.key, { price: e.target.value })} />
            </Field>
            <Field label="Stock" error={err(i, "stock")}>
              <Input
                inputMode="numeric"
                className={cardInput}
                value={v.track_inventory ? v.stock : ""}
                disabled={!v.track_inventory}
                placeholder={v.track_inventory ? "0" : "—"}
                onChange={(e) => onUpdate(v.key, { stock: e.target.value })}
              />
            </Field>
          </div>
          <details className="group mt-2" open={ADVANCED_FIELDS.concat("compare_at_price").some((f) => err(i, f)) || undefined}>
            <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-adm-link [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
              Más datos
            </summary>
            <div className="grid grid-cols-2 gap-3 pb-1">
              <Field label="Precio tachado" error={err(i, "compare_at_price")}>
                <Input
                  inputMode="decimal"
                  leading="$"
                  className={cardInput}
                  value={v.compare_at_price}
                  onChange={(e) => onUpdate(v.key, { compare_at_price: e.target.value })}
                />
              </Field>
              <Field label="Costo" error={err(i, "cost")}>
                <Input inputMode="decimal" leading="$" className={cardInput} value={v.cost} onChange={(e) => onUpdate(v.key, { cost: e.target.value })} />
              </Field>
              <Field label="SKU" error={err(i, "sku")}>
                <Input className={cn(cardInput, "font-mono")} value={v.sku} onChange={(e) => onUpdate(v.key, { sku: e.target.value })} maxLength={64} />
              </Field>
              <Field label="Cód. de barras" error={err(i, "barcode")}>
                <Input className={cn(cardInput, "font-mono")} value={v.barcode} onChange={(e) => onUpdate(v.key, { barcode: e.target.value })} maxLength={64} />
              </Field>
              <Field label="Aviso de stock bajo" error={err(i, "low_stock_threshold")}>
                <Input
                  inputMode="numeric"
                  className={cardInput}
                  value={v.low_stock_threshold}
                  disabled={!v.track_inventory}
                  onChange={(e) => onUpdate(v.key, { low_stock_threshold: e.target.value })}
                />
              </Field>
              <Field label="Peso (g)" error={err(i, "weight_grams")}>
                <Input inputMode="numeric" className={cardInput} value={v.weight_grams} onChange={(e) => onUpdate(v.key, { weight_grams: e.target.value })} />
              </Field>
              <div className="col-span-2 space-y-1">
                <Checkbox checked={v.track_inventory} onChange={(e) => onUpdate(v.key, { track_inventory: e.target.checked })} label="Controlar stock" className="min-h-11 items-center" />
                <Checkbox
                  checked={v.allow_backorder}
                  disabled={!v.track_inventory}
                  onChange={(e) => onUpdate(v.key, { allow_backorder: e.target.checked })}
                  label="Vender sin stock"
                  className="min-h-11 items-center"
                />
              </div>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

function CellInput({
  label,
  value,
  onChange,
  error,
  disabled,
  placeholder,
  inputMode,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  mono?: boolean;
}) {
  return (
    <input
      aria-label={label}
      aria-invalid={error ? true : undefined}
      title={error}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      className={cn(cellInput, inputMode && "tnum text-right", mono && "font-mono text-xs")}
    />
  );
}

function VariantImagePicker({
  images,
  value,
  url,
  label,
  onChange,
  large,
}: {
  images: AdminImage[];
  value: string | null;
  url: string | null;
  label: string;
  onChange: (id: string | null) => void;
  large?: boolean;
}) {
  const trigger = (
    <button
      type="button"
      aria-label={`Imagen de ${label}`}
      disabled={!images.length}
      title={images.length ? "Elegir imagen" : "Subí imágenes al producto para asignarlas"}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-adm-sm border border-adm-border bg-adm-surface-2 hover:border-adm-input-border disabled:cursor-not-allowed",
        large ? "size-11" : "size-8",
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <ImageOff className="size-3.5 text-adm-fg-muted" aria-hidden />
      )}
    </button>
  );
  if (!images.length) return trigger;
  return (
    <DropdownMenu trigger={trigger} align="start" width={220}>
      <DropdownItem onSelect={() => onChange(null)} icon={<ImageOff />}>
        {value ? "Quitar imagen" : "Sin imagen propia"}
      </DropdownItem>
      {images.map((img, i) => (
        <DropdownItem
          key={img.id}
          onSelect={() => onChange(img.id)}
          icon={
            // eslint-disable-next-line @next/next/no-img-element -- miniatura
            <img src={img.url} alt="" className="!size-6 rounded-[3px] object-cover" />
          }
        >
          {`Imagen ${i + 1}${img.id === value ? " (actual)" : ""}`}
        </DropdownItem>
      ))}
    </DropdownMenu>
  );
}
