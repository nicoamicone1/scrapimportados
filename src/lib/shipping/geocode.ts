import "server-only";

/**
 * Geocodificación con Nominatim (OpenStreetMap). SÓLO server: Nominatim exige
 * un User-Agent identificable y máximo 1 request por segundo, así que desde
 * el browser se pasa por `/api/geocode` (admin) o por una server action.
 *
 * - Caché en memoria por query (TTL 1 h; también cachea "sin resultados").
 * - Cola: como mucho 1 request por segundo por proceso.
 * - Timeout 6 s por request.
 */
import { normalizePostalCode, normalizeProvince, normalizeText, provinceName, type ProvinceCode } from "./provinces";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Ecommy/0.0 (contacto: ver store_settings)";
const TIMEOUT_MS = 6000;
const TTL_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1100;
const MAX_CACHE = 500;
/** Candidatos por búsqueda de dirección (se elige el que coincide con calle y provincia). */
const CANDIDATES = 5;

export type GeocodeConfidence = "high" | "medium" | "low";

export interface GeocodeAddressInput {
  street?: string | null;
  number?: string | null;
  city?: string | null;
  /** Nombre o código ISO ("AR-X"). */
  province?: string | null;
  postal_code?: string | null;
  country?: "AR";
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Dirección legible que devolvió Nominatim. */
  displayName: string;
  /**
   * `high`: encontró la altura exacta (edificio / número).
   * `medium`: encontró la calle o hubo que reintentar sin número.
   * `low`: sólo barrio / ciudad, o la provincia no coincide con la pedida.
   */
  confidence: GeocodeConfidence;
  /** Provincia del resultado (ISO) si Nominatim la informa. */
  province: ProvinceCode | null;
  /** CP del resultado si Nominatim lo informa (dígitos o CPA). */
  postalCode: string | null;
  city: string | null;
  /** [[south, west], [north, east]] para encuadrar un mapa. */
  bounds: [[number, number], [number, number]] | null;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  "ISO3166-2-lvl4"?: string;
  postcode?: string;
  country_code?: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  place_rank?: number;
  addresstype?: string;
  type?: string;
  category?: string;
  boundingbox?: [string, string, string, string];
  address?: NominatimAddress;
}

// ---------------------------------------------------------------------------
// Caché + cola
// ---------------------------------------------------------------------------

const cache = new Map<string, { expires: number; value: unknown }>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + TTL_MS, value });
}

/** Sólo para tests. */
export function clearGeocodeCache() {
  cache.clear();
  lastRequestAt = 0;
}

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Serializa los requests a Nominatim respetando 1 por segundo. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return task();
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

async function nominatim<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const url = `${NOMINATIM}${path}?${new URLSearchParams(params).toString()}`;
  const cached = cacheGet<T | null>(url);
  if (cached !== undefined) return cached;
  try {
    const data = await throttled(async () => {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "es", Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      return (await res.json()) as T;
    });
    cacheSet(url, data);
    return data;
  } catch (err) {
    // Timeouts / 429 / red: no se cachean (se puede reintentar).
    console.error("[geocode]", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Conversión
// ---------------------------------------------------------------------------

/** Palabra principal de una calle ("Av. Santa Fe" → "santa fe"; "Bv. Oroño" → "orono"; "Calle 7" → "7"). */
function streetKey(street: string | null | undefined): string | null {
  const words = normalizeText(street ?? "")
    .split(" ")
    .filter((w) => w && !/^(av|avda|avenida|calle|bv|bvd|bulevar|boulevard|pasaje|pje|diagonal|diag|ruta|camino|gral|general|dr|doctor|pte|presidente)$/.test(w));
  return words.length ? words.join(" ") : null;
}

/** ¿La calle del resultado es la pedida? (evita estaciones o comercios que se llaman como la calle). */
function streetMatches(place: NominatimPlace, street: string | null | undefined): boolean {
  const key = streetKey(street);
  if (!key) return true;
  // Sólo la calle (no el nombre del lugar: una estación "Corrientes" no es la Av. Corrientes).
  const road = normalizeText(place.address?.road ?? place.display_name);
  return key.split(" ").every((w) => road.includes(w));
}

function toResult(
  place: NominatimPlace,
  request: { province: ProvinceCode | null; street?: string | null; number?: string | null },
  retried: boolean,
): GeocodeResult | null {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const addr = place.address ?? {};
  const province = normalizeProvince(addr["ISO3166-2-lvl4"]) ?? normalizeProvince(addr.state);
  const rank = place.place_rank ?? 0;
  const wantedNumber = (request.number ?? "").replace(/\D/g, "");
  const gotNumber = (addr.house_number ?? "").replace(/\D/g, "");
  let confidence: GeocodeConfidence =
    gotNumber && (!wantedNumber || gotNumber === wantedNumber) ? "high" : rank >= 26 || addr.road ? "medium" : "low";
  if (retried && confidence === "high") confidence = "medium";
  if (request.street && !streetMatches(place, request.street)) confidence = "low";
  if (request.province && province && request.province !== province) confidence = "low";
  const bb = place.boundingbox?.map(Number);
  return {
    lat,
    lng,
    displayName: place.display_name,
    confidence,
    province,
    postalCode: addr.postcode ?? null,
    city: addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.suburb ?? null,
    bounds:
      bb && bb.length === 4 && bb.every(Number.isFinite)
        ? [
            [bb[0], bb[2]],
            [bb[1], bb[3]],
          ]
        : null,
  };
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** Arma el texto de búsqueda ("Av. Santa Fe 3253, Palermo, Ciudad Autónoma de Buenos Aires, Argentina"). */
export function buildAddressQuery(input: GeocodeAddressInput, withNumber = true): string {
  const street = clean(input.street);
  const number = withNumber ? clean(input.number) : "";
  const provinceCode = normalizeProvince(input.province);
  const province = provinceCode ? provinceName(provinceCode) : clean(input.province);
  const city = clean(input.city);
  const parts = [
    [street, number].filter(Boolean).join(" "),
    // Evita "Buenos Aires, Ciudad Autónoma de Buenos Aires" cuando la ciudad repite la provincia.
    city && normalizeProvince(city) !== provinceCode ? city : "",
    province,
    "Argentina",
  ];
  return parts.filter(Boolean).join(", ");
}

async function search(q: string, limit: number): Promise<NominatimPlace[]> {
  const data = await nominatim<NominatimPlace[]>("/search", {
    format: "jsonv2",
    countrycodes: "ar",
    addressdetails: "1",
    limit: String(limit),
    "accept-language": "es",
    q,
  });
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

const RANK: Record<GeocodeConfidence, number> = { high: 3, medium: 2, low: 1 };

/** Mejor candidato: prioriza la calle y provincia pedidas y la altura exacta (Nominatim a veces pone primero un comercio o una estación). */
function pickBest(
  places: NominatimPlace[],
  request: Parameters<typeof toResult>[1],
  retried: boolean,
): GeocodeResult | null {
  let best: GeocodeResult | null = null;
  for (const place of places) {
    const r = toResult(place, request, retried);
    if (r && (!best || RANK[r.confidence] > RANK[best.confidence])) best = r;
  }
  return best;
}

/**
 * Dirección → punto. Si no encuentra la dirección con la altura (o encuentra
 * otra calle u otra provincia), reintenta una vez sin el número de calle
 * (confianza como mucho `medium`). `null` si no hay resultado, si Nominatim no
 * responde en 6 s o si falta calle y ciudad.
 */
export async function geocodeAddress(input: GeocodeAddressInput): Promise<GeocodeResult | null> {
  const request = { province: normalizeProvince(input.province), street: input.street, number: input.number };
  if (!clean(input.street) && !clean(input.city)) return null;

  const first = pickBest(await search(buildAddressQuery(input, true), CANDIDATES), request, false);
  if (first && first.confidence !== "low") return first;

  if (clean(input.number) && clean(input.street)) {
    const retry = pickBest(await search(buildAddressQuery(input, false), CANDIDATES), request, true);
    if (retry && (!first || retry.confidence !== "low")) return retry;
  }
  if (first) return first;

  // Sin calle: el CP suele ubicar la localidad.
  const postal = normalizePostalCode(input.postal_code);
  if (postal.digits && !clean(input.street)) {
    return pickBest(await search(`${postal.digits}, ${buildAddressQuery({ province: input.province })}`, 1), request, true);
  }
  return null;
}

/** Punto → dirección (para "hacé click en el mapa" y para completar provincia/CP). */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const place = await nominatim<NominatimPlace & { error?: string }>("/reverse", {
    format: "jsonv2",
    lat: lat.toFixed(6),
    lon: lng.toFixed(6),
    zoom: "18",
    addressdetails: "1",
    "accept-language": "es",
  });
  if (!place || place.error) return null;
  const result = toResult(place, { province: null }, false);
  // En reverse, el punto es el que eligió la persona, no el del resultado.
  return result ? { ...result, lat, lng } : null;
}

/** Buscador de lugares (texto libre) para centrar el mapa del admin. Hasta 5 resultados. */
export async function searchPlaces(query: string, limit = 5): Promise<GeocodeResult[]> {
  const q = clean(query);
  if (q.length < 3) return [];
  const places = await search(q, Math.min(Math.max(limit, 1), 10));
  return places.map((p) => toResult(p, { province: null }, false)).filter((r): r is GeocodeResult => r !== null);
}
