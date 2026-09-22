/**
 * Jurisdicciones argentinas (ISO 3166-2:AR) y normalización tolerante de
 * nombres de provincia y códigos postales (CP de 4 dígitos y CPA).
 *
 * Puro: se usa en el admin (cliente y server) y en el checkout.
 */

export type ProvinceCode =
  | "AR-C"
  | "AR-B"
  | "AR-K"
  | "AR-H"
  | "AR-U"
  | "AR-X"
  | "AR-W"
  | "AR-E"
  | "AR-P"
  | "AR-Y"
  | "AR-L"
  | "AR-F"
  | "AR-M"
  | "AR-N"
  | "AR-Q"
  | "AR-R"
  | "AR-A"
  | "AR-J"
  | "AR-D"
  | "AR-Z"
  | "AR-S"
  | "AR-G"
  | "AR-V"
  | "AR-T";

export interface Province {
  /** Código ISO 3166-2 ("AR-X"). Es lo que se guarda en `shipping_zones.provinces`. */
  code: ProvinceCode;
  /** Nombre para mostrar. */
  name: string;
  /** Nombre normalizado (minúsculas, sin acentos ni puntuación). */
  normalized: string;
  /** Letra del CPA (coincide con la letra del código ISO). */
  letter: string;
}

/** Normaliza texto libre: minúsculas, sin acentos, sin puntuación, espacios simples. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,;:()'"/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RAW: [ProvinceCode, string][] = [
  ["AR-C", "Ciudad Autónoma de Buenos Aires"],
  ["AR-B", "Buenos Aires"],
  ["AR-K", "Catamarca"],
  ["AR-H", "Chaco"],
  ["AR-U", "Chubut"],
  ["AR-X", "Córdoba"],
  ["AR-W", "Corrientes"],
  ["AR-E", "Entre Ríos"],
  ["AR-P", "Formosa"],
  ["AR-Y", "Jujuy"],
  ["AR-L", "La Pampa"],
  ["AR-F", "La Rioja"],
  ["AR-M", "Mendoza"],
  ["AR-N", "Misiones"],
  ["AR-Q", "Neuquén"],
  ["AR-R", "Río Negro"],
  ["AR-A", "Salta"],
  ["AR-J", "San Juan"],
  ["AR-D", "San Luis"],
  ["AR-Z", "Santa Cruz"],
  ["AR-S", "Santa Fe"],
  ["AR-G", "Santiago del Estero"],
  ["AR-V", "Tierra del Fuego"],
  ["AR-T", "Tucumán"],
];

/** Las 24 jurisdicciones en el orden habitual (CABA y Buenos Aires primero, después alfabético). */
export const PROVINCES: readonly Province[] = RAW.map(([code, name]) => ({
  code,
  name,
  normalized: normalizeText(name),
  letter: code.slice(3),
}));

export const PROVINCE_CODES: readonly ProvinceCode[] = PROVINCES.map((p) => p.code);

const BY_CODE = new Map<string, Province>(PROVINCES.map((p) => [p.code, p]));
const BY_LETTER = new Map<string, Province>(PROVINCES.map((p) => [p.letter, p]));

export function isProvinceCode(value: unknown): value is ProvinceCode {
  return typeof value === "string" && BY_CODE.has(value);
}

/** "AR-X" → "Córdoba". Devuelve el valor tal cual si no es un código conocido. */
export function provinceName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

/** Opciones para un `<select>` de provincias (valor = código ISO). */
export const PROVINCE_OPTIONS: readonly { value: ProvinceCode; label: string }[] = PROVINCES.map((p) => ({
  value: p.code,
  label: p.name,
}));

/**
 * Alias (ya normalizados) → código. Incluye abreviaturas y formas en que
 * Nominatim, Google o la gente escriben cada provincia.
 */
const ALIASES: Record<string, ProvinceCode> = {
  // CABA
  caba: "AR-C",
  "c a b a": "AR-C",
  "capital federal": "AR-C",
  "cap fed": "AR-C",
  "ciudad autonoma de buenos aires": "AR-C",
  "ciudad autonoma buenos aires": "AR-C",
  "ciudad de buenos aires": "AR-C",
  "buenos aires ciudad": "AR-C",
  "autonomous city of buenos aires": "AR-C",
  "ciudad autonoma": "AR-C",
  // Provincia de Buenos Aires
  pba: "AR-B",
  "p b a": "AR-B",
  bsas: "AR-B",
  gba: "AR-B",
  "gran buenos aires": "AR-B",
  "buenos aires province": "AR-B",
  // Otras abreviaturas comunes
  cba: "AR-X",
  cordoba: "AR-X",
  ctes: "AR-W",
  "e rios": "AR-E",
  "entre rios": "AR-E",
  mza: "AR-M",
  nqn: "AR-Q",
  "r negro": "AR-R",
  "rio negro": "AR-R",
  sfe: "AR-S",
  "s fe": "AR-S",
  "santiago": "AR-G",
  "santiago del estero": "AR-G",
  "s del estero": "AR-G",
  sde: "AR-G",
  tdf: "AR-V",
  "tierra del fuego antartida e islas del atlantico sur": "AR-V",
  "tierra del fuego antartida e islas del atlantico": "AR-V",
  tuc: "AR-T",
  "s juan": "AR-J",
  "s luis": "AR-D",
  "s cruz": "AR-Z",
  "la pampa": "AR-L",
};

/** Expande abreviaturas frecuentes antes de buscar ("Bs. As." → "buenos aires"). */
function expand(text: string): string {
  return text
    .replace(/\bbs ?as\b/g, "buenos aires")
    .replace(/\bbue\b/g, "buenos aires")
    .replace(/\bcdad\b/g, "ciudad")
    .replace(/\baut\b/g, "autonoma")
    .replace(/\bsgo\b|\bstgo\b/g, "santiago")
    .replace(/\bsta\b/g, "santa")
    .replace(/\bpcia\b|\bprov\b/g, "provincia")
    .replace(/^provincia (de |del )?/, "")
    .replace(/\s+argentina$/, "")
    .trim();
}

/**
 * Nombre, abreviatura o código de provincia → código ISO ("AR-X") o `null`.
 *
 *   normalizeProvince("Bs. As.")                          // "AR-B"
 *   normalizeProvince("CABA")                             // "AR-C"
 *   normalizeProvince("Capital Federal")                  // "AR-C"
 *   normalizeProvince("Ciudad Autónoma de Buenos Aires")  // "AR-C"
 *   normalizeProvince("cordoba")                          // "AR-X"
 *   normalizeProvince("AR-S") / ("S")                     // "AR-S"
 */
export function normalizeProvince(input: string | null | undefined): ProvinceCode | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // Código ISO ("AR-C", "ar c") o letra suelta del CPA ("C").
  const iso = /^(?:ar[\s-]?)?([a-z])$/i.exec(raw);
  if (iso) return BY_LETTER.get(iso[1].toUpperCase())?.code ?? null;

  const text = expand(normalizeText(raw));
  if (!text) return null;
  const alias = ALIASES[text];
  if (alias) return alias;
  const exact = PROVINCES.find((p) => p.normalized === text);
  if (exact) return exact.code;
  // "Provincia de Córdoba, Argentina", "Mendoza Province"…
  const stripped = text.replace(/\bprovince\b|\bprovincia\b/g, "").replace(/\s+/g, " ").trim();
  const loose = ALIASES[stripped] ?? PROVINCES.find((p) => p.normalized === stripped)?.code;
  if (loose) return loose;
  // "Capital Federal, Buenos Aires", "CABA - Ciudad de Buenos Aires"…
  if (/\b(caba|capital federal|ciudad autonoma)\b/.test(text)) return "AR-C";
  return null;
}

// ---------------------------------------------------------------------------
// Códigos postales
// ---------------------------------------------------------------------------

export interface PostalCodeParts {
  /** Los 4 dígitos del CP ("1900"), o los dígitos que haya. */
  digits: string | null;
  /** CPA completo en mayúsculas ("B1900ABC"), si se ingresó uno. */
  cpa: string | null;
  /** Letra de provincia del CPA ("B"), si hay. */
  letter: string | null;
}

/**
 * "B1900ABC" → { digits: "1900", cpa: "B1900ABC", letter: "B" }
 * "1900" / " 1 900 " → { digits: "1900", cpa: null, letter: null }
 */
export function normalizePostalCode(input: string | null | undefined): PostalCodeParts {
  const clean = (input ?? "").toUpperCase().replace(/[\s.-]+/g, "");
  if (!clean) return { digits: null, cpa: null, letter: null };
  const cpa = /^([A-Z])(\d{4})([A-Z]{3})?$/.exec(clean);
  if (cpa) return { digits: cpa[2], cpa: cpa[3] ? clean : null, letter: cpa[1] };
  const digits = clean.replace(/\D/g, "");
  return { digits: digits || null, cpa: null, letter: null };
}

/** Provincia a partir de la letra del CPA ("B1900ABC" → "AR-B"). */
export function provinceFromPostalCode(input: string | null | undefined): ProvinceCode | null {
  const { letter } = normalizePostalCode(input);
  return letter ? (BY_LETTER.get(letter)?.code ?? null) : null;
}

/** Prefijo válido: 1 a 4 dígitos ("19", "1900"), letra + dígitos ("B19") o CPA completo ("B1900ABC"). */
export const POSTAL_PREFIX_RE = /^(?:\d{1,4}|[A-Z]\d{1,4}|[A-Z]\d{4}[A-Z]{3})$/;

/** Normaliza un prefijo cargado por el dueño (mayúsculas, sin espacios). */
export function normalizePostalPrefix(input: string): string {
  return input.toUpperCase().replace(/[\s.-]+/g, "");
}

/** Separa un texto con prefijos por coma, punto y coma, espacio o salto de línea. */
export function parsePostalPrefixes(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    const p = normalizePostalPrefix(part);
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * ¿El CP de la dirección empieza con el prefijo?
 * - Prefijo numérico ("19"): compara contra los dígitos del CP/CPA.
 * - Prefijo con letra ("B19"): exige la misma letra (del CPA o de la provincia) y dígitos.
 * - CPA completo ("B1900ABC"): exige CPA igual.
 */
export function postalCodeMatchesPrefix(
  postal: PostalCodeParts,
  prefix: string,
  provinceCode?: ProvinceCode | null,
): boolean {
  const p = normalizePostalPrefix(prefix);
  if (!p) return false;
  if (/^\d+$/.test(p)) return postal.digits !== null && postal.digits.startsWith(p);
  const m = /^([A-Z])(\d{1,4})([A-Z]{3})?$/.exec(p);
  if (!m) return false;
  if (m[3]) return postal.cpa === p;
  const letter = postal.letter ?? (provinceCode ? provinceCode.slice(3) : null);
  return letter === m[1] && postal.digits !== null && postal.digits.startsWith(m[2]);
}
