/**
 * Resolución de la zona de envío de una dirección (puro, cliente y server).
 *
 * Regla: se recorren las zonas ACTIVAS ordenadas por `position` (menor
 * primero) y gana la primera que incluye la dirección. Cada zona se evalúa
 * según su tipo:
 * - `polygon`: punto dentro del Polygon/MultiPolygon (necesita `point`).
 * - `provinces`: provincia normalizada (o letra del CPA si no vino provincia).
 * - `postal_prefixes`: el CP (sin espacios; del CPA "B1900ABC" se toman los dígitos) empieza con algún prefijo.
 * - `everywhere`: siempre.
 */
import { asZoneGeometry, pointInGeometry, type LatLng } from "./geometry";
import {
  normalizePostalCode,
  normalizeProvince,
  postalCodeMatchesPrefix,
  provinceFromPostalCode,
  type ProvinceCode,
} from "./provinces";

export type ShippingZoneType = "polygon" | "provinces" | "postal_prefixes" | "everywhere";

export const ZONE_TYPES: readonly ShippingZoneType[] = ["polygon", "provinces", "postal_prefixes", "everywhere"];

export const ZONE_TYPE_LABELS: Record<ShippingZoneType, string> = {
  polygon: "Polígono",
  provinces: "Provincias",
  postal_prefixes: "Códigos postales",
  everywhere: "Todo el país",
};

/**
 * Forma mínima de una zona para resolver. Coincide con `StoreShippingZone`
 * de `src/lib/store/shipping.ts` (se le pueden pasar esas zonas directo).
 */
export interface ResolvableZone {
  id: string;
  name: string;
  type: ShippingZoneType | (string & {});
  /** GeoJSON Polygon / MultiPolygon (sólo `polygon`). */
  geometry: unknown;
  provinces: string[];
  postalPrefixes: string[];
  cost: number;
  freeOver: number | null;
  etaText: string | null;
  position: number;
  /** Si viene `false`, la zona se ignora (las del storefront ya vienen filtradas). */
  isActive?: boolean;
}

/** Dirección tal como la carga el cliente (mismas claves que `orders.shipping_address`). */
export interface ShippingAddressInput {
  street?: string | null;
  number?: string | null;
  city?: string | null;
  /** Nombre ("Córdoba", "CABA", "Bs. As.") o código ISO ("AR-X"). */
  province?: string | null;
  /** CP de 4 dígitos o CPA ("B1900ABC"). */
  postal_code?: string | null;
}

export interface ResolveZoneInput<Z extends ResolvableZone = ResolvableZone> {
  zones: readonly Z[];
  address: ShippingAddressInput;
  /** Punto geocodificado. Sin punto, las zonas `polygon` no matchean. */
  point?: LatLng | null;
  /** Si se pasa, `cost` ya aplica el envío gratis (`free_over`). */
  subtotal?: number;
}

export interface ZoneResolution<Z extends ResolvableZone = ResolvableZone> {
  zone: Z;
  /** Costo del envío: con `subtotal` aplica `free_over`; sin él, el costo de lista. */
  cost: number;
  freeOver: number | null;
  /** Demora ("24 a 48 hs") o null. */
  eta: string | null;
  /** Por qué matcheó (tipo de la zona). */
  matchedBy: ShippingZoneType;
}

interface MatchContext {
  point: LatLng | null;
  province: ProvinceCode | null;
  postal: ReturnType<typeof normalizePostalCode>;
}

function buildContext(address: ShippingAddressInput, point?: LatLng | null): MatchContext {
  const postal = normalizePostalCode(address.postal_code);
  return {
    point: point && Number.isFinite(point.lat) && Number.isFinite(point.lng) ? point : null,
    province: normalizeProvince(address.province) ?? provinceFromPostalCode(address.postal_code),
    postal,
  };
}

function matches(zone: ResolvableZone, ctx: MatchContext): boolean {
  switch (zone.type) {
    case "polygon": {
      if (!ctx.point) return false;
      const geometry = asZoneGeometry(zone.geometry);
      return geometry ? pointInGeometry(ctx.point, geometry) : false;
    }
    case "provinces": {
      if (!ctx.province) return false;
      return zone.provinces.some((p) => normalizeProvince(p) === ctx.province);
    }
    case "postal_prefixes":
      return zone.postalPrefixes.some((prefix) => postalCodeMatchesPrefix(ctx.postal, prefix, ctx.province));
    case "everywhere":
      return true;
    default:
      return false;
  }
}

/** Zonas activas en orden de evaluación (position asc; empate por nombre para que sea estable). */
export function sortZones<Z extends ResolvableZone>(zones: readonly Z[]): Z[] {
  return zones
    .filter((z) => z.isActive !== false)
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/** Costo final de una zona para un subtotal: 0 si alcanza `free_over`. Igual que `create_order` en SQL. */
export function computeShippingCost(zone: Pick<ResolvableZone, "cost" | "freeOver">, subtotal: number): number {
  if (zone.freeOver !== null && zone.freeOver !== undefined && subtotal >= zone.freeOver) return 0;
  return Math.max(0, zone.cost);
}

/** Cuánto falta para el envío gratis de la zona (null si la zona no tiene `free_over`). */
export function amountForFreeShipping(zone: Pick<ResolvableZone, "freeOver">, subtotal: number): number | null {
  if (zone.freeOver === null || zone.freeOver === undefined) return null;
  return Math.max(0, zone.freeOver - subtotal);
}

/**
 * Zona que corresponde a una dirección, o `null` si ninguna la incluye
 * (en el checkout: "No llegamos a tu zona todavía").
 */
export function resolveZone<Z extends ResolvableZone>({
  zones,
  address,
  point,
  subtotal,
}: ResolveZoneInput<Z>): ZoneResolution<Z> | null {
  const ctx = buildContext(address, point);
  for (const zone of sortZones(zones)) {
    if (!matches(zone, ctx)) continue;
    return {
      zone,
      cost: subtotal === undefined ? Math.max(0, zone.cost) : computeShippingCost(zone, subtotal),
      freeOver: zone.freeOver,
      eta: zone.etaText,
      matchedBy: zone.type as ShippingZoneType,
    };
  }
  return null;
}

export interface ZoneEvaluation<Z extends ResolvableZone = ResolvableZone> {
  zone: Z;
  /** ¿La zona incluye la dirección? (independiente del orden). */
  includes: boolean;
  /** ¿Es la que gana? */
  winner: boolean;
  /** La zona está inactiva (no participa en el checkout). */
  inactive: boolean;
}

/**
 * Evalúa TODAS las zonas (incluidas las inactivas) para la herramienta
 * "Probar dirección" del admin: cuáles incluyen la dirección y cuál gana.
 */
export function evaluateZones<Z extends ResolvableZone>({
  zones,
  address,
  point,
}: Omit<ResolveZoneInput<Z>, "subtotal">): ZoneEvaluation<Z>[] {
  const ctx = buildContext(address, point);
  const winner = resolveZone({ zones, address, point });
  return zones
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((zone) => ({
      zone,
      includes: matches(zone, ctx),
      winner: winner?.zone.id === zone.id,
      inactive: zone.isActive === false,
    }));
}
