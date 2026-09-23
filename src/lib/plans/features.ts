/**
 * Planes: feature flags y límites (spec §14.1). Fuente única del lado TS;
 * los valores efectivos viven en `public.plans` (editables desde /platform)
 * y `PLAN_DEFAULTS` es su espejo (seed de la migración 0011) para textos,
 * comparaciones y tests. Si cambiás uno, cambiá el otro.
 */

export const PLAN_CODES = ["free", "starter", "pro", "business"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const PLAN_NAMES: Record<PlanCode, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export const FEATURES = {
  "catalog.variants": { label: "Variantes (talle, color…)" },
  "catalog.import_csv": { label: "Importar y actualizar desde planilla (CSV)" },
  "catalog.import_web": { label: "Importar catálogos desde otra web" },
  "pricing.bulk": { label: "Cambios masivos de precios" },
  "marketing.promotions": { label: "Promociones programadas" },
  "marketing.coupons": { label: "Cupones de descuento" },
  "content.landings": { label: "Landings y páginas extra" },
  "theme.custom_css": { label: "CSS personalizado" },
  "theme.all_presets": { label: "Todos los estilos de tienda" },
  "shipping.polygons": { label: "Zonas de envío por mapa" },
  "orders.print": { label: "Remitos para imprimir" },
  "orders.export": { label: "Exportar pedidos y catálogo (CSV)" },
  "analytics.integrations": { label: "Google Analytics, Tag Manager y Meta Pixel" },
  "domain.custom": { label: "Dominio propio" },
  "team.members": { label: "Equipo (más usuarios)" },
  "audit.log": { label: "Registro de auditoría" },
} as const satisfies Record<string, { label: string }>;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

export const LIMITS = {
  products: { label: "Productos", unit: "productos" },
  pages: { label: "Páginas (incluye la de inicio)", unit: "páginas" },
  staff: { label: "Usuarios del equipo", unit: "usuarios" },
  promotions: { label: "Promociones", unit: "promociones" },
  coupons: { label: "Cupones", unit: "cupones" },
  images_per_product: { label: "Fotos por producto", unit: "fotos" },
  import_jobs_month: { label: "Importaciones por mes", unit: "importaciones" },
  storage_mb: { label: "Almacenamiento", unit: "MB" },
} as const satisfies Record<string, { label: string; unit: string }>;

export type LimitKey = keyof typeof LIMITS;
export const LIMIT_KEYS = Object.keys(LIMITS) as LimitKey[];

export type PlanFeatures = Record<FeatureKey, boolean>;
/** `null` = ilimitado. */
export type PlanLimits = Record<LimitKey, number | null>;

const ALL_ON = Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as PlanFeatures;

export const PLAN_DEFAULTS: Record<PlanCode, { features: PlanFeatures; limits: PlanLimits; price: number | null }> = {
  free: {
    price: 0,
    features: {
      ...ALL_ON,
      "catalog.import_csv": false,
      "catalog.import_web": false,
      "pricing.bulk": false,
      "marketing.promotions": false,
      "content.landings": false,
      "theme.custom_css": false,
      "theme.all_presets": false,
      "orders.export": false,
      "analytics.integrations": false,
      "domain.custom": false,
      "team.members": false,
      "audit.log": false,
    },
    limits: {
      products: 50,
      pages: 1,
      staff: 1,
      promotions: 0,
      coupons: 3,
      images_per_product: 3,
      import_jobs_month: 0,
      storage_mb: 200,
    },
  },
  starter: {
    price: 14999,
    features: {
      ...ALL_ON,
      "catalog.import_web": false,
      "pricing.bulk": false,
      "theme.custom_css": false,
      "orders.export": false,
      "domain.custom": false,
      "audit.log": false,
    },
    limits: {
      products: 500,
      pages: 6,
      staff: 3,
      promotions: 10,
      coupons: 20,
      images_per_product: 8,
      import_jobs_month: 10,
      storage_mb: 1000,
    },
  },
  pro: {
    price: 34999,
    features: { ...ALL_ON },
    limits: {
      products: null,
      pages: null,
      staff: 10,
      promotions: null,
      coupons: null,
      images_per_product: 20,
      import_jobs_month: null,
      storage_mb: 5000,
    },
  },
  business: {
    price: null,
    features: { ...ALL_ON },
    limits: {
      products: null,
      pages: null,
      staff: null,
      promotions: null,
      coupons: null,
      images_per_product: null,
      import_jobs_month: null,
      storage_mb: null,
    },
  },
};

/** Presets de tema disponibles en Free (`theme.all_presets` habilita el resto). */
export const FREE_THEME_PRESETS: readonly string[] = ["nordico", "mercado"];

/** Primer plan (en orden) que incluye la feature según los defaults. */
export function featureMinPlan(key: FeatureKey): PlanCode {
  return PLAN_CODES.find((code) => PLAN_DEFAULTS[code].features[key]) ?? "business";
}

/** Primer plan cuyo límite supera `needed` (null = ilimitado). */
export function limitMinPlan(key: LimitKey, needed: number): PlanCode {
  return (
    PLAN_CODES.find((code) => {
      const limit = PLAN_DEFAULTS[code].limits[key];
      return limit === null || limit >= needed;
    }) ?? "business"
  );
}

/** "Disponible desde el plan Starter". */
export function upgradeMessage(key: FeatureKey): string {
  return `Esta función está disponible desde el plan ${PLAN_NAMES[featureMinPlan(key)]}.`;
}

export function limitMessage(key: LimitKey, limit: number, planName: string): string {
  const { unit } = LIMITS[key];
  const next = limitMinPlan(key, limit + 1);
  return `Tu plan ${planName} permite hasta ${limit} ${unit}. Pasate a ${PLAN_NAMES[next]} para sumar más.`;
}
