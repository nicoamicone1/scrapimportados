/**
 * Tipos y constantes compartidos por los mapas de envíos (sin Leaflet: se
 * puede importar desde server y client).
 */
import type { GeocodeResult } from "@/lib/shipping/geocode";

export interface MapCenter {
  lat: number;
  lng: number;
  zoom: number;
}

/** Obelisco, Buenos Aires. */
export const DEFAULT_CENTER: MapCenter = { lat: -34.6037, lng: -58.3816, zoom: 11 };

export const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

/** Resultado del buscador (subset serializable de GeocodeResult). */
export type PlaceResult = Pick<GeocodeResult, "lat" | "lng" | "displayName" | "bounds" | "province" | "postalCode" | "city" | "confidence">;

/** Busca lugares vía `/api/geocode` (admin). Lanza Error con mensaje en español. */
export async function fetchPlaces(query: string): Promise<PlaceResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
  const body = (await res.json().catch(() => null)) as { results?: PlaceResult[]; error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "No pudimos buscar. Probá de nuevo.");
  return body?.results ?? [];
}

/** Colores fijos de los mapas (tokens del admin; Leaflet necesita valores literales). */
export const MAP_COLORS = {
  accent: "#2e4a3f",
  accentFill: "#2e4a3f",
  muted: "#6b6860",
  selected: "#2b5a84",
  draft: "#9a5b00",
  inactive: "#8a867d",
} as const;
