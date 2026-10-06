import { PLAN_CODES, PLAN_DEFAULTS, PLAN_NAMES, type FeatureKey, type PlanInfo } from "@/lib/plans";

/*
 * "Desde qué plan" para los textos públicos (landing, FAQ). Se calcula con
 * los planes de la base (editables en /platform) para que el copy no quede
 * desactualizado; sin planes cargados usa los defaults del código.
 */

export type PlanLike = Pick<PlanInfo, "features" | "name"> & Partial<Pick<PlanInfo, "priceMonthly">>;

function orDefaults(plans: readonly PlanLike[]): readonly PlanLike[] {
  return plans.length
    ? plans
    : PLAN_CODES.map((code) => ({ name: PLAN_NAMES[code], features: PLAN_DEFAULTS[code].features, priceMonthly: PLAN_DEFAULTS[code].price }));
}

/** Nombre del primer plan (en orden) que incluye la función, o `null` si ninguno. */
export function minPlanName(plans: readonly PlanLike[], key: FeatureKey): string | null {
  return orDefaults(plans).find((p) => p.features[key])?.name ?? null;
}

/** "todos los planes" · "desde Starter" · "a pedido" (si ningún plan público la incluye). */
export function availability(plans: readonly PlanLike[], key: FeatureKey): string {
  const list = orDefaults(plans);
  const idx = list.findIndex((p) => p.features[key]);
  if (idx === -1) return "a pedido";
  if (idx === 0 && list.every((p) => p.features[key])) return "todos los planes";
  return `desde ${list[idx].name}`;
}

/**
 * Como `availability`, para ir después de un sustantivo ("cupones …"):
 * "en todos los planes" · "desde Starter" · "en Pro" (cuando los planes que
 * siguen no tienen precio publicado, o sea son a medida) · "a pedido".
 */
export function availabilityPhrase(plans: readonly PlanLike[], key: FeatureKey): string {
  const list = orDefaults(plans);
  const av = availability(list, key);
  if (av === "todos los planes") return "en todos los planes";
  if (av === "a pedido") return av;
  const idx = list.findIndex((p) => p.features[key]);
  const onlyCustomAfter = list.slice(idx + 1).every((p) => p.priceMonthly === null);
  return onlyCustomAfter ? `en ${list[idx].name}` : av;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Líneas de "desde qué plan" de la landing (funciones y "También incluye"). */
export function landingPlanLines(plans: readonly PlanLike[]) {
  const at = (key: FeatureKey) => availabilityPhrase(plans, key);
  return {
    /** "(desde Starter)" en el paso de cargar el catálogo. */
    csvPlan: minPlanName(plans, "catalog.import_csv") ?? "Starter",
    /** "(Pro, incluido en la prueba)". */
    webPlan: minPlanName(plans, "catalog.import_web") ?? "Pro",
    catalog: `Variantes ${at("catalog.variants")} · planilla CSV ${at("catalog.import_csv")} · importación desde otra web ${at("catalog.import_web")}`,
    pricing: `Cupones ${at("marketing.coupons")} · promos programadas ${at("marketing.promotions")} · precios masivos ${at("pricing.bulk")}`,
    shipping: capitalize(at("shipping.polygons")),
    /** "desde Pro": las 301 desde el sitio anterior sólo sirven con dominio propio. */
    customDomain: availability(plans, "domain.custom"),
    /** Etiqueta suelta: "Pro" · "Desde Starter" · "Todos los planes". */
    migration: capitalize(at("catalog.import_web").replace(/^en /, "")),
    team: `Equipo ${at("team.members")} · auditoría ${at("audit.log")}`,
    pages: `Inicio en todos los planes · landings ${at("content.landings")}`,
  };
}

/**
 * Cada función de plan contada como lo que el comercio gana (tarjetas de
 * planes). La etiqueta técnica (`FEATURES[k].label`) queda para la tabla
 * comparativa; acá, una frase corta y cierta hoy.
 */
const FEATURE_BENEFITS: Record<FeatureKey, string> = {
  "catalog.variants": "Talles y colores, cada uno con su stock",
  "catalog.import_csv": "Cargás o actualizás el catálogo con una planilla",
  "catalog.import_web": "Traés el catálogo de tu web actual",
  "pricing.bulk": "Subís los precios de una categoría entera de una vez",
  "pricing.tiers": "Precio mayorista según la cantidad",
  "marketing.promotions": "Promos con fecha de inicio y de fin",
  "marketing.coupons": "Cupones de descuento",
  "marketing.abandoned": "Mail automático a quien dejó el carrito",
  "content.landings": "Landings para campañas y páginas extra",
  "theme.custom_css": "CSS propio para ajustar el diseño al detalle",
  "theme.all_presets": "Todos los estilos de tienda",
  "shipping.polygons": "Zonas de envío dibujadas en el mapa",
  "orders.print": "Remitos listos para imprimir",
  "orders.replies": "Respuestas a WhatsApp con precio, stock y link",
  "orders.export": "Pedidos y catálogo a CSV cuando quieras",
  "analytics.integrations": "Google Analytics, Tag Manager y Meta Pixel",
  "domain.custom": "Tu dominio propio",
  "team.members": "Tu equipo, cada uno con su usuario",
  "audit.log": "Registro de quién cambió qué",
};

export function featureBenefit(key: FeatureKey): string {
  return FEATURE_BENEFITS[key];
}
