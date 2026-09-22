import "server-only";

import { unstable_cache } from "next/cache";

import type { Json } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/server";

import { CACHE_REVALIDATE } from "./utils";

export interface StoreShippingZone {
  id: string;
  name: string;
  type: "polygon" | "provinces" | "postal_prefixes" | "everywhere";
  /** GeoJSON Polygon / MultiPolygon (WGS84). */
  geometry: Json | null;
  provinces: string[];
  postalPrefixes: string[];
  cost: number;
  freeOver: number | null;
  etaText: string | null;
  position: number;
}

export interface StorePickupLocation {
  id: string;
  name: string;
  address: string | null;
  hoursText: string | null;
  lat: number | null;
  lng: number | null;
  instructionsMd: string | null;
}

/** Lectura SIN cache (checkout: precios/costos tienen que ser los actuales). */
export async function fetchShippingZonesFresh(): Promise<StoreShippingZone[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shipping_zones")
    .select("id, name, type, geometry, provinces, postal_prefixes, cost, free_over, eta_text, position")
    .eq("is_active", true)
    .order("position");
  if (error) throw new Error(`No se pudieron leer las zonas de envío: ${error.message}`);
  return (data ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    type: z.type as StoreShippingZone["type"],
    geometry: z.geometry,
    provinces: z.provinces,
    postalPrefixes: z.postal_prefixes,
    cost: Number(z.cost),
    freeOver: z.free_over === null ? null : Number(z.free_over),
    etaText: z.eta_text,
    position: z.position,
  }));
}

export const getShippingZones = unstable_cache(
  () => fetchShippingZonesFresh(),
  ["store-shipping-zones"],
  { tags: ["shipping"], revalidate: CACHE_REVALIDATE },
);

/** Lectura SIN cache (checkout: precios/costos tienen que ser los actuales). */
export async function fetchPickupLocationsFresh(): Promise<StorePickupLocation[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("pickup_locations")
    .select("id, name, address, hours_text, lat, lng, instructions_md")
    .eq("is_active", true)
    .order("position");
  if (error) throw new Error(`No se pudieron leer los puntos de retiro: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    hoursText: p.hours_text,
    lat: p.lat,
    lng: p.lng,
    instructionsMd: p.instructions_md,
  }));
}

export const getPickupLocations = unstable_cache(
  () => fetchPickupLocationsFresh(),
  ["store-pickup-locations"],
  { tags: ["shipping"], revalidate: CACHE_REVALIDATE },
);
