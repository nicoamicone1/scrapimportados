import "server-only";

/**
 * Cotización de envío de punta a punta para el checkout (server):
 * geocodifica SÓLO si hay zonas por polígono y después resuelve la zona.
 *
 *   const zones = await getShippingZones();            // src/lib/store/shipping.ts
 *   const quote = await quoteShipping({ zones, address, subtotal });
 *   if (!quote.resolution) → "No llegamos a tu zona todavía"
 */
import { geocodeAddress, type GeocodeResult } from "./geocode";
import type { LatLng } from "./geometry";
import { resolveZone, sortZones, type ResolvableZone, type ShippingAddressInput, type ZoneResolution } from "./resolve";

export interface ShippingQuote<Z extends ResolvableZone = ResolvableZone> {
  resolution: ZoneResolution<Z> | null;
  /** Punto usado para los polígonos (el que vino o el geocodificado). */
  point: LatLng | null;
  /** Resultado de Nominatim si hubo que geocodificar. */
  geocode: GeocodeResult | null;
}

export async function quoteShipping<Z extends ResolvableZone>({
  zones,
  address,
  subtotal,
  point,
}: {
  zones: readonly Z[];
  address: ShippingAddressInput;
  subtotal?: number;
  /** Si el cliente ya tiene lat/lng (ej. lo marcó en un mapa), se usa y no se geocodifica. */
  point?: LatLng | null;
}): Promise<ShippingQuote<Z>> {
  let usedPoint = point ?? null;
  let geocode: GeocodeResult | null = null;
  const active = sortZones(zones);
  const needsPoint = active.some((z) => z.type === "polygon");
  if (!usedPoint && needsPoint) {
    geocode = await geocodeAddress({ ...address, country: "AR" });
    if (geocode) usedPoint = { lat: geocode.lat, lng: geocode.lng };
  }
  return { resolution: resolveZone({ zones: active, address, point: usedPoint, subtotal }), point: usedPoint, geocode };
}
