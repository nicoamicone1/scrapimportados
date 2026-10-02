import type { AdminMaterial, AdminPrinter, AdminSpool, Print3dSettings } from "@/lib/admin/print3d-config";
import type { CostBreakdown } from "@/lib/print3d/types";

import { averageCostPerGram, pickPrinterFor, unitCost } from "./math";

export interface SpecCostInput {
  material_id: string;
  color_id: string | null;
  grams_per_unit: number;
  minutes_per_unit: number;
  post_minutes: number;
}

export interface SpecCostContext {
  materials: AdminMaterial[];
  spools: AdminSpool[];
  printers: AdminPrinter[];
  settings: Pick<Print3dSettings, "kwh_price" | "labor_hour_cost">;
}

/**
 * Costo por unidad de un producto que se imprime (§3.6): costo por gramo de
 * las bobinas de ese color (o del material si el color no tiene costo), la
 * primera impresora activa que imprime ese material, luz y post-proceso.
 */
export function specUnitCost(spec: SpecCostInput, ctx: SpecCostContext): (CostBreakdown & { printerName: string | null }) | null {
  const material = ctx.materials.find((m) => m.id === spec.material_id);
  if (!material) return null;
  const colorIds = spec.color_id ? [spec.color_id] : material.colors.map((c) => c.id);
  const perGram = averageCostPerGram(ctx.spools.filter((s) => colorIds.includes(s.color_id))) ?? material.avg_cost_per_gram;
  const printer = pickPrinterFor(ctx.printers, material.type);
  const cost = unitCost(
    { grams: spec.grams_per_unit, minutes: spec.minutes_per_unit, post_minutes: spec.post_minutes },
    { spool_cost_per_gram: perGram, printer, kwh_price: ctx.settings.kwh_price, labor_hour_cost: ctx.settings.labor_hour_cost },
  );
  return { ...cost, incomplete: cost.incomplete || perGram === null, printerName: printer?.name ?? null };
}
