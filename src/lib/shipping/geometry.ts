/**
 * Geometrías de zonas de envío (GeoJSON Polygon / MultiPolygon, WGS84).
 * Ojo con el orden: GeoJSON usa [lng, lat]; Leaflet usa [lat, lng].
 *
 * Puro (cliente y server).
 */
import { area as turfArea } from "@turf/area";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { MultiPolygon, Polygon, Position } from "geojson";

export type ZoneGeometry = Polygon | MultiPolygon;

/** Punto en grados decimales. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Un polígono = lista de anillos [lng, lat]; el primero es el exterior, el resto huecos. */
export type PolygonRings = Position[][];

export type GeometryResult = { ok: true; geometry: ZoneGeometry } | { ok: false; error: string };

const DECIMALS = 1e6; // ~11 cm: suficiente y mantiene el JSON chico.

function round(n: number): number {
  return Math.round(n * DECIMALS) / DECIMALS;
}

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Cierra el anillo (primer punto = último) sin mutar el original. */
export function closeRing(ring: Position[]): Position[] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return samePosition(first, last) ? ring.slice() : [...ring, [first[0], first[1]]];
}

/** Anillo sin el punto de cierre (para editar vértices). */
export function openRing(ring: Position[]): Position[] {
  if (ring.length > 1 && samePosition(ring[0], ring[ring.length - 1])) return ring.slice(0, -1);
  return ring.slice();
}

function isNumberPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

/** Valida y normaliza un anillo: redondea, saca duplicados consecutivos y lo cierra. */
function normalizeRing(value: unknown, label: string): { ok: true; ring: Position[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: `${label}: se esperaba una lista de coordenadas.` };
  const ring: Position[] = [];
  for (const raw of value) {
    if (!isNumberPair(raw)) return { ok: false, error: `${label}: hay una coordenada inválida.` };
    const lng = round(raw[0]);
    const lat = round(raw[1]);
    if (lng < -180 || lng > 180) return { ok: false, error: `${label}: la longitud ${raw[0]} está fuera de rango (−180 a 180).` };
    if (lat < -90 || lat > 90) return { ok: false, error: `${label}: la latitud ${raw[1]} está fuera de rango (−90 a 90).` };
    const prev = ring[ring.length - 1];
    if (!prev || !samePosition(prev, [lng, lat])) ring.push([lng, lat]);
  }
  const closed = closeRing(ring);
  if (closed.length < 4) return { ok: false, error: `${label}: un polígono necesita al menos 3 vértices distintos.` };
  return { ok: true, ring: closed };
}

function normalizePolygonCoords(value: unknown, label: string): { ok: true; rings: PolygonRings } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: `${label}: no tiene anillos.` };
  const rings: PolygonRings = [];
  for (let i = 0; i < value.length; i++) {
    const r = normalizeRing(value[i], i === 0 ? label : `${label}, hueco ${i}`);
    if (!r.ok) return r;
    rings.push(r.ring);
  }
  return { ok: true, rings };
}

/** Junta polígonos en la geometría mínima: Polygon si hay uno, MultiPolygon si hay varios. */
export function polygonsToGeometry(polygons: PolygonRings[]): ZoneGeometry | null {
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0] };
  return { type: "MultiPolygon", coordinates: polygons };
}

/** Lista de polígonos (cada uno con sus anillos) de una geometría. */
export function geometryToPolygons(geometry: ZoneGeometry | null | undefined): PolygonRings[] {
  if (!geometry) return [];
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

/** Extrae los polígonos crudos de cualquier GeoJSON aceptado (geometría, Feature o FeatureCollection). */
function collectPolygons(input: unknown, out: unknown[][], depth = 0): string | null {
  if (depth > 3) return "El GeoJSON está demasiado anidado.";
  if (!input || typeof input !== "object") return "Se esperaba un objeto GeoJSON.";
  const obj = input as { type?: unknown; coordinates?: unknown; geometry?: unknown; features?: unknown; geometries?: unknown };
  switch (obj.type) {
    case "Polygon":
      out.push(obj.coordinates as unknown[]);
      return null;
    case "MultiPolygon":
      if (!Array.isArray(obj.coordinates)) return "MultiPolygon sin coordenadas.";
      for (const poly of obj.coordinates) out.push(poly as unknown[]);
      return null;
    case "Feature":
      return collectPolygons(obj.geometry, out, depth + 1);
    case "FeatureCollection": {
      if (!Array.isArray(obj.features)) return "FeatureCollection sin features.";
      for (const f of obj.features) {
        const err = collectPolygons(f, out, depth + 1);
        if (err) return err;
      }
      return null;
    }
    case "GeometryCollection": {
      if (!Array.isArray(obj.geometries)) return "GeometryCollection sin geometrías.";
      for (const g of obj.geometries) {
        const err = collectPolygons(g, out, depth + 1);
        if (err) return err;
      }
      return null;
    }
    default:
      return typeof obj.type === "string"
        ? `Tipo "${obj.type}" no soportado: usá Polygon o MultiPolygon.`
        : "Falta el campo \"type\" del GeoJSON.";
  }
}

/**
 * Valida y normaliza cualquier GeoJSON con polígonos (Polygon, MultiPolygon,
 * Feature, FeatureCollection, GeometryCollection) → Polygon / MultiPolygon:
 * coordenadas en rango, anillos cerrados con ≥ 4 posiciones, 6 decimales.
 */
export function normalizeGeometry(input: unknown): GeometryResult {
  const raw: unknown[][] = [];
  const err = collectPolygons(input, raw);
  if (err) return { ok: false, error: err };
  if (raw.length === 0) return { ok: false, error: "El GeoJSON no tiene polígonos." };
  const polygons: PolygonRings[] = [];
  for (let i = 0; i < raw.length; i++) {
    const res = normalizePolygonCoords(raw[i], raw.length > 1 ? `Polígono ${i + 1}` : "Polígono");
    if (!res.ok) return res;
    polygons.push(res.rings);
  }
  const geometry = polygonsToGeometry(polygons);
  return geometry ? { ok: true, geometry } : { ok: false, error: "El GeoJSON no tiene polígonos." };
}

/** Parsea texto (textarea de importación) → geometría normalizada. */
export function parseGeoJsonText(text: string): GeometryResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Pegá un GeoJSON." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "No es un JSON válido." };
  }
  return normalizeGeometry(parsed);
}

/**
 * Chequeo liviano (sin normalizar) para geometrías que vienen de la DB:
 * devuelve la geometría tipada o `null` si no tiene forma de polígono.
 */
export function asZoneGeometry(value: unknown): ZoneGeometry | null {
  if (!value || typeof value !== "object") return null;
  const g = value as { type?: unknown; coordinates?: unknown };
  if ((g.type === "Polygon" || g.type === "MultiPolygon") && Array.isArray(g.coordinates) && g.coordinates.length > 0) {
    return g as ZoneGeometry;
  }
  return null;
}

/** ¿El punto está dentro de la geometría? El borde cuenta como adentro. */
export function pointInGeometry(point: LatLng, geometry: ZoneGeometry): boolean {
  try {
    return booleanPointInPolygon([point.lng, point.lat], geometry);
  } catch {
    return false;
  }
}

/** Área aproximada en km² (geodésica, turf). */
export function geometryAreaKm2(geometry: ZoneGeometry | null | undefined): number {
  if (!geometry) return 0;
  try {
    return turfArea(geometry) / 1_000_000;
  } catch {
    return 0;
  }
}

/** Cantidad de vértices (sin contar el punto de cierre de cada anillo). */
export function countVertices(geometry: ZoneGeometry | null | undefined): number {
  let n = 0;
  for (const poly of geometryToPolygons(geometry)) {
    for (const ring of poly) n += openRing(ring).length;
  }
  return n;
}

/** Bounding box [[south, west], [north, east]] (formato Leaflet) o `null`. */
export function geometryBounds(geometry: ZoneGeometry | null | undefined): [[number, number], [number, number]] | null {
  let s = Infinity;
  let w = Infinity;
  let n = -Infinity;
  let e = -Infinity;
  for (const poly of geometryToPolygons(geometry)) {
    for (const [lng, lat] of poly[0] ?? []) {
      if (lat < s) s = lat;
      if (lat > n) n = lat;
      if (lng < w) w = lng;
      if (lng > e) e = lng;
    }
  }
  return Number.isFinite(s) ? [[s, w], [n, e]] : null;
}
