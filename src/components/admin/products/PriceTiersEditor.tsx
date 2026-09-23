"use client";

import { Plus, Trash2 } from "lucide-react";

import { useOptionalAdminStore } from "@/components/admin/AdminStoreContext";
import { PlanGate } from "@/components/admin/PlanGate";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/money";
import { hasFeature } from "@/lib/plans";
import { MAX_PRICE_TIERS, tierRangeLabel, tierSavingsPercent } from "@/lib/pricing/tiers";

import { newKey, parseDecimal, parseInteger, type FormTier } from "./form-state";

type Errors = Record<string, string[] | undefined>;

/** Cantidad sugerida para el tramo nuevo: 6, 12, 24… (duplica el anterior). */
function nextQty(rows: FormTier[]): string {
  const last = parseInteger(rows[rows.length - 1]?.min_qty ?? "");
  if (last === null || Number.isNaN(last) || last < 2) return rows.length ? "" : "6";
  return String(Math.min(last * 2, 999));
}

/**
 * "Precio por cantidad" del form de producto: hasta 4 tramos "Desde N
 * unidades → $ precio c/u" con el ahorro frente al precio base. Las filas
 * vacías no se guardan. Plan: `pricing.tiers` (si la tienda bajó de plan y
 * ya tenía tramos, se pueden ver y quitar, no cambiar: lo controla la action).
 */
export function PriceTiersEditor({
  value,
  onChange,
  basePrice,
  errors,
  sharedAcrossVariants,
}: {
  value: FormTier[];
  onChange: (rows: FormTier[]) => void;
  /** Precio más bajo de las variantes activas (null si todavía no hay precio). */
  basePrice: number | null;
  errors: Errors;
  /** El producto tiene variantes: los tramos cuentan todas juntas. */
  sharedAcrossVariants: boolean;
}) {
  const store = useOptionalAdminStore();
  const allowed = !store || hasFeature(store.plan, "pricing.tiers");
  const sectionError = errors.price_tiers?.[0];

  if (!allowed && !value.length) {
    return (
      <PlanGate
        feature="pricing.tiers"
        description="Precio mayorista por producto: «desde 6 unidades, $ 900 c/u». La tienda lo aplica sola en el carrito."
      >
        {null}
      </PlanGate>
    );
  }

  // Índice de cada fila en el payload (las vacías no viajan) para ubicar los errores de zod.
  const filled = value.map((row) => Boolean(row.min_qty.trim() || row.price.trim()));
  const indexed = value.map((row, i) => ({ row, idx: filled[i] ? filled.slice(0, i).filter(Boolean).length : null }));

  const update = (key: string, patch: Partial<FormTier>) => onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Vista previa de la tabla que ve el comprador (sólo con filas válidas y ordenadas).
  const parsed = value
    .map((r) => ({ qty: parseInteger(r.min_qty), price: parseDecimal(r.price) }))
    .filter((r): r is { qty: number; price: number } => r.qty !== null && r.price !== null && Number.isFinite(r.qty) && Number.isFinite(r.price));
  const previewOk =
    basePrice !== null &&
    parsed.length > 0 &&
    parsed.length === value.length &&
    parsed.every((r, i) => r.qty >= 2 && r.price > 0 && r.price < basePrice && (i === 0 || (r.qty > parsed[i - 1].qty && r.price < parsed[i - 1].price)));

  return (
    <div className="space-y-3">
      {!allowed ? (
        <p className="rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2 text-[13px] text-adm-fg-muted">
          Tu plan ya no incluye precios por cantidad. Estos tramos se siguen aplicando; podés quitarlos, pero para cambiarlos necesitás
          un plan que los incluya.
        </p>
      ) : null}

      {value.length ? (
        <ul className="space-y-2" aria-label="Tramos de precio por cantidad">
          <li className="hidden grid-cols-[minmax(0,9rem)_minmax(0,11rem)_minmax(0,1fr)_32px] gap-3 text-xs text-adm-fg-muted sm:grid">
            <span>Desde</span>
            <span>Precio c/u</span>
            <span />
            <span />
          </li>
          {indexed.map(({ row, idx }, i) => {
            const qtyError = idx !== null ? errors[`price_tiers.${idx}.min_qty`]?.[0] : undefined;
            const priceError = idx !== null ? errors[`price_tiers.${idx}.price`]?.[0] : undefined;
            const price = parseDecimal(row.price);
            const saving = basePrice !== null && price !== null && Number.isFinite(price) ? tierSavingsPercent(basePrice, price) : 0;
            return (
              <li key={row.key}>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,11rem)_minmax(0,1fr)_32px]">
                  <Input
                    aria-label={`Tramo ${i + 1}: desde cuántas unidades`}
                    inputMode="numeric"
                    trailing="u."
                    value={row.min_qty}
                    invalid={Boolean(qtyError)}
                    placeholder="6"
                    onChange={(e) => update(row.key, { min_qty: e.target.value })}
                  />
                  <Input
                    aria-label={`Tramo ${i + 1}: precio por unidad`}
                    inputMode="decimal"
                    leading="$"
                    value={row.price}
                    invalid={Boolean(priceError)}
                    placeholder="0"
                    onChange={(e) => update(row.key, { price: e.target.value })}
                  />
                  <span className="tnum col-span-2 row-start-2 text-[13px] text-adm-fg-muted sm:col-span-1 sm:row-start-auto">
                    {saving > 0 ? `Ahorro ${saving} %` : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar tramo ${i + 1}`}
                    className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto"
                    onClick={() => onChange(value.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {qtyError || priceError ? <p className="mt-1 text-xs text-adm-danger">{qtyError ?? priceError}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-adm-fg-muted">
          Precio mayorista: desde cierta cantidad, cada unidad sale menos. Por ejemplo, desde 6 unidades a $ 900 y desde 12 a $ 800.
        </p>
      )}

      {sectionError ? <p className="text-xs text-adm-danger">{sectionError}</p> : null}

      {previewOk && basePrice !== null ? (
        <p className="tnum text-[13px] text-adm-fg-muted">
          En la tienda: {tierRangeLabel(1, parsed[0].qty - 1)} u. {formatMoney(basePrice)}
          {parsed.map((r, i) => (
            <span key={r.qty}>
              {" · "}
              {tierRangeLabel(r.qty, parsed[i + 1] ? parsed[i + 1].qty - 1 : null)} u. {formatMoney(r.price)}
            </span>
          ))}
          {sharedAcrossVariants ? ". Suman todas las variantes." : "."}
        </p>
      ) : null}

      {allowed ? (
        <Button
          size="sm"
          icon={<Plus />}
          disabled={value.length >= MAX_PRICE_TIERS}
          onClick={() => onChange([...value, { key: newKey("t"), min_qty: nextQty(value), price: "" }])}
        >
          {value.length >= MAX_PRICE_TIERS ? `Hasta ${MAX_PRICE_TIERS} tramos` : "Agregar tramo"}
        </Button>
      ) : null}
    </div>
  );
}
