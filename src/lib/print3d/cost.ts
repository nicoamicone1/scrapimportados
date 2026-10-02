/*
 * Taller 3D — costo real de un trabajo (spec §3.6): material, luz,
 * amortización de la impresora, mano de obra de post-proceso y desperdicio.
 */
import { round2 } from "./round";
import type { CostBreakdown, CostContext, CostInputs } from "./types";

/**
 * Costo por gramo promedio de un grupo de bobinas (Σ costo / Σ gramos netos).
 * Para cuando el trabajo no tiene bobina: las del color o, si no hay, las del
 * material. Sin bobinas con datos → null.
 */
export function averageCostPerGram(spools: { cost: number; net_grams: number }[]): number | null {
  let cost = 0;
  let grams = 0;
  for (const s of spools) {
    if (!(s.net_grams > 0) || !Number.isFinite(s.cost)) continue;
    cost += s.cost;
    grams += s.net_grams;
  }
  return grams > 0 ? cost / grams : null;
}

/**
 * energía = W/1000 · h · $/kWh; amortización = precio / vida útil (h) · h;
 * labor = post-proceso (h) · $/h; desperdicio = gramos perdidos · $/g.
 * `incomplete` si falta el costo del filamento o la impresora.
 */
export function jobCost(inp: CostInputs, ctx: CostContext): CostBreakdown {
  const perGram = ctx.spool_cost_per_gram ?? 0;
  const hours = Math.max(0, inp.minutes) / 60;
  const printer = ctx.printer;
  const material = round2(Math.max(0, inp.grams) * perGram);
  const energy = printer ? round2((printer.watts / 1000) * hours * ctx.kwh_price) : 0;
  const amortization =
    printer && printer.lifetime_hours > 0 ? round2((printer.purchase_price / printer.lifetime_hours) * hours) : 0;
  const labor = round2((Math.max(0, inp.post_minutes) / 60) * ctx.labor_hour_cost);
  const waste = round2(Math.max(0, inp.wasted_grams) * perGram);
  return {
    material,
    energy,
    amortization,
    labor,
    waste,
    total: round2(material + energy + amortization + labor + waste),
    incomplete: ctx.spool_cost_per_gram === null || printer === null,
  };
}

/** Suma de varios trabajos (costo de un pedido). */
export function sumCosts(costs: CostBreakdown[]): CostBreakdown {
  const sum = (key: "material" | "energy" | "amortization" | "labor" | "waste" | "total") =>
    round2(costs.reduce((acc, c) => acc + c[key], 0));
  return {
    material: sum("material"),
    energy: sum("energy"),
    amortization: sum("amortization"),
    labor: sum("labor"),
    waste: sum("waste"),
    total: sum("total"),
    incomplete: costs.some((c) => c.incomplete),
  };
}
