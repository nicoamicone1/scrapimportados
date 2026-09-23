import "server-only";

/**
 * Lecturas del admin de envíos (sin caché; bajo RLS como el admin logueado).
 */
import { requireAdmin } from "@/lib/auth";
import { searchPlaces } from "@/lib/shipping/geocode";
import { asZoneGeometry, type ZoneGeometry } from "@/lib/shipping/geometry";
import type { ResolvableZone, ShippingZoneType } from "@/lib/shipping/resolve";
import type { Tables } from "@/lib/supabase/database.types";

export interface AdminShippingZone extends ResolvableZone {
  type: ShippingZoneType;
  geometry: ZoneGeometry | null;
  isActive: boolean;
  notes: string | null;
  updatedAt: string;
}

export interface AdminPickupLocation {
  id: string;
  name: string;
  address: string | null;
  hoursText: string | null;
  instructionsMd: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  position: number;
}

export function mapZoneRow(z: Tables<"shipping_zones">): AdminShippingZone {
  return {
    id: z.id,
    name: z.name,
    type: z.type as ShippingZoneType,
    geometry: asZoneGeometry(z.geometry),
    provinces: z.provinces ?? [],
    postalPrefixes: z.postal_prefixes ?? [],
    cost: Number(z.cost),
    freeOver: z.free_over === null ? null : Number(z.free_over),
    etaText: z.eta_text,
    position: z.position,
    isActive: z.is_active,
    notes: z.notes,
    updatedAt: z.updated_at,
  };
}

export function mapPickupRow(p: Tables<"pickup_locations">): AdminPickupLocation {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    hoursText: p.hours_text,
    instructionsMd: p.instructions_md,
    lat: p.lat,
    lng: p.lng,
    isActive: p.is_active,
    position: p.position,
  };
}

/** Todas las zonas (activas e inactivas) en orden de evaluación. */
export async function listShippingZones(): Promise<AdminShippingZone[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("shipping_zones")
    .select("*")
    .eq("store_id", store.id)
    .order("position")
    .order("created_at");
  if (error) throw new Error(`No se pudieron leer las zonas: ${error.message}`);
  return (data ?? []).map(mapZoneRow);
}

export async function getShippingZone(id: string): Promise<AdminShippingZone | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase.from("shipping_zones").select("*").eq("store_id", store.id).eq("id", id).maybeSingle();
  if (error) throw new Error(`No se pudo leer la zona: ${error.message}`);
  return data ? mapZoneRow(data) : null;
}

export async function listPickupLocations(): Promise<AdminPickupLocation[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("pickup_locations")
    .select("*")
    .eq("store_id", store.id)
    .order("position")
    .order("created_at");
  if (error) throw new Error(`No se pudieron leer los puntos de retiro: ${error.message}`);
  return (data ?? []).map(mapPickupRow);
}

/**
 * Centro inicial de los mapas del admin: la dirección de la tienda
 * (`store_settings.address`) si se puede geocodificar; si no, Buenos Aires.
 */
export async function getMapCenter(): Promise<{ lat: number; lng: number; zoom: number }> {
  const fallback = { lat: -34.6037, lng: -58.3816, zoom: 11 };
  const { supabase, store } = await requireAdmin();
  const { data } = await supabase.from("store_settings").select("address").eq("store_id", store.id).maybeSingle();
  const address = data?.address?.trim();
  if (!address) return fallback;
  const [place] = await searchPlaces(address, 1);
  return place ? { lat: place.lat, lng: place.lng, zoom: 13 } : fallback;
}
