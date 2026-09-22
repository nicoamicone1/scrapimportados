"use client";

import { Field, Input, Select, Switch } from "@/components/ui";
import type { ImportOptions } from "@/lib/schemas/import";

export interface CategoryOption {
  id: string;
  name: string;
}

const ROUND_OPTIONS = [
  { value: "0", label: "Sin redondeo" },
  { value: "10", label: "Al múltiplo de 10 siguiente" },
  { value: "100", label: "Al múltiplo de 100 siguiente" },
  { value: "1000", label: "Al múltiplo de 1.000 siguiente" },
  { value: "990", label: "Terminado en 990 (12.345 → 12.990)" },
];

/**
 * Opciones de un job de importación. `variant`:
 *  - "url": todas (recargo, stock, re-sync, límite, revisión).
 *  - "csv-create": las que aplican a crear productos desde CSV.
 */
export function ImportOptionsFields({
  value,
  onChange,
  categories,
  variant,
  errors,
}: {
  value: ImportOptions;
  onChange: (next: ImportOptions) => void;
  categories: CategoryOption[];
  variant: "url" | "csv-create";
  errors?: Record<string, string[]>;
}) {
  const set = <K extends keyof ImportOptions>(key: K, v: ImportOptions[K]) => onChange({ ...value, [key]: v });
  const err = (k: string) => errors?.[`options.${k}`] ?? errors?.[k];
  const isUrl = variant === "url";

  return (
    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
      <Field
        label="Recargo sobre el precio de origen"
        hint={isUrl ? "Ej.: 40 si el origen es tu proveedor mayorista. Con recargo, el precio de origen queda como costo." : "Se suma a los precios del archivo. Dejalo en 0 para usarlos tal cual."}
        error={err("markup_percent")}
      >
        <Input
          type="number"
          inputMode="decimal"
          step="0.5"
          min={-90}
          max={1000}
          trailing="%"
          value={String(value.markup_percent)}
          onChange={(e) => set("markup_percent", Number(e.target.value || 0))}
        />
      </Field>

      <Field label="Redondeo del precio final" hint="Siempre redondea hacia arriba, nunca perdés margen.">
        <Select
          value={String(value.round_to)}
          onChange={(e) => set("round_to", Number(e.target.value))}
          options={ROUND_OPTIONS}
        />
      </Field>

      <Field label="Estado de los productos nuevos" hint="Borrador: no se ven en la tienda hasta que los revises.">
        <Select
          value={value.default_status}
          onChange={(e) => set("default_status", e.target.value === "active" ? "active" : "draft")}
          options={[
            { value: "draft", label: "Borrador" },
            { value: "active", label: "Activo (publicado)" },
          ]}
        />
      </Field>

      <Field label="Categorías" hint="Crear: arma las categorías del origen con su jerarquía (reusa las que ya existen).">
        <Select
          value={value.category_mode}
          onChange={(e) => {
            const mode = e.target.value === "single" ? "single" : e.target.value === "none" ? "none" : "create";
            onChange({ ...value, category_mode: mode, default_category_id: mode === "single" ? value.default_category_id : null });
          }}
          options={[
            { value: "create", label: "Crear las del origen" },
            { value: "single", label: "Todo a una categoría" },
            { value: "none", label: "No asignar categorías" },
          ]}
        />
      </Field>

      {value.category_mode === "single" ? (
        <Field label="Categoría destino" error={err("default_category_id")} required>
          <Select
            value={value.default_category_id ?? ""}
            onChange={(e) => set("default_category_id", e.target.value || null)}
            placeholder="Elegí una categoría"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
      ) : null}

      {isUrl ? (
        <>
          <Field
            label="Stock cuando la fuente sólo dice “en stock”"
            hint="Casi ninguna tienda publica la cantidad. Si no hay stock, se carga 0."
            error={err("stock_when_unknown")}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={String(value.stock_when_unknown)}
              onChange={(e) => set("stock_when_unknown", Math.max(0, Math.round(Number(e.target.value || 0))))}
            />
          </Field>

          <Field label="Máximo de productos a traer" hint="Para probar, empezá con pocos." error={err("limit")}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              step={1}
              value={String(value.limit)}
              onChange={(e) => set("limit", Math.max(1, Math.round(Number(e.target.value || 1))))}
            />
          </Field>
        </>
      ) : null}

      <div className="space-y-3 md:col-span-2">
        <Switch
          checked={value.import_images}
          onCheckedChange={(v) => set("import_images", v)}
          label="Importar imágenes"
          description="Se descargan, se optimizan (WebP, máx. 1600 px) y se suben a tu tienda. Si lo apagás, los productos nuevos quedan sin fotos."
        />
        {isUrl ? (
          <>
            <Switch
              checked={value.create_new}
              onCheckedChange={(v) => set("create_new", v)}
              label="Crear productos nuevos"
              description="Apagalo para sólo actualizar los productos que ya importaste antes."
            />
            <Switch
              checked={value.update_existing}
              onCheckedChange={(v) => set("update_existing", v)}
              label="Actualizar productos ya importados"
              description="Se reconocen por el ID del origen. Nunca se pisan nombre, descripción ni estado."
            />
            {value.update_existing ? (
              <div className="space-y-3 border-l-2 border-adm-border pl-4">
                <Switch
                  checked={value.sync_prices}
                  onCheckedChange={(v) => set("sync_prices", v)}
                  label="Sincronizar precios"
                  description="Apagalo si ajustaste precios a mano y no querés perderlos. Los cambios se pueden deshacer desde Precios."
                />
                <Switch
                  checked={value.sync_stock}
                  onCheckedChange={(v) => set("sync_stock", v)}
                  label="Sincronizar stock"
                  description="Si el origen se quedó sin stock, se pone en 0; si vuelve a tener y acá estaba en 0, se carga el stock de arriba."
                />
              </div>
            ) : null}
            <Switch
              checked={value.review}
              onCheckedChange={(v) => set("review", v)}
              label="Revisar antes de importar"
              description="Primero se lee el catálogo y después elegís qué productos importar."
            />
          </>
        ) : (
          <Switch
            checked={value.update_existing}
            onCheckedChange={(v) => set("update_existing", v)}
            label="Actualizar productos que ya existen"
            description="Si el handle coincide con el de un producto de la tienda, se actualizan sus variantes en lugar de crear otro."
          />
        )}
      </div>
    </div>
  );
}
