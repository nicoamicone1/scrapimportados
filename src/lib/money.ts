/**
 * Dinero. En la DB es numeric(12,2); en TS es `number`.
 * Formatear SIEMPRE con `formatMoney` (nunca `toFixed` a mano).
 */

export interface MoneyOptions {
  currency?: string;
  locale?: string;
  /** Forzar decimales (por defecto: 0 si es entero, 2 si tiene centavos). */
  decimals?: 0 | 2;
}

export const DEFAULT_CURRENCY = "ARS";
export const DEFAULT_LOCALE = "es-AR";

const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: string, decimals: number) {
  const key = `${locale}|${currency}|${decimals}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    cache.set(key, f);
  }
  return f;
}

/** Redondeo a centavos (evita 0.1 + 0.2 = 0.30000000000000004). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Monedas en las que los precios de venta se manejan sin centavos (los
 * precios con promo se redondean hacia arriba a la unidad: "$ 26.041", no
 * "$ 26.040,60"). El resto mantiene 2 decimales.
 */
const WHOLE_UNIT_CURRENCIES = new Set(["ARS", "CLP", "COP", "PYG", "JPY", "KRW", "HUF", "VND"]);

let activeCurrency = DEFAULT_CURRENCY;

/**
 * Fija la moneda de la tienda para `priceDecimals()` / `roundPrice()`.
 * Una tienda por deploy: lo llama `getSettings()` en el server y
 * `<ConfigureMoney>` en el cliente. Por defecto ARS.
 */
export function configureMoney(currency: string | null | undefined) {
  if (currency) activeCurrency = currency.toUpperCase();
}

/** 0 para monedas sin centavos en la práctica (ARS…), 2 para el resto. */
export function priceDecimals(): 0 | 2 {
  return WHOLE_UNIT_CURRENCIES.has(activeCurrency) ? 0 : 2;
}

/**
 * Redondeo de un PRECIO calculado (promo, descuento) a la granularidad de la
 * moneda, siempre hacia arriba: nunca queda por debajo del piso que valida
 * `create_order` en la base.
 */
export function roundPrice(value: number): number {
  if (priceDecimals() === 0) return Math.max(0, Math.ceil(value - 1e-9));
  return Math.max(0, Math.ceil((value - 1e-9) * 100) / 100);
}

/**
 * 41262 → "$ 41.262"; 1234.5 → "$ 1.234,50".
 * El espacio entre símbolo y número es irrompible (no se parte en 2 líneas).
 */
export function formatMoney(value: number | null | undefined, options: MoneyOptions = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const currency = options.currency ?? DEFAULT_CURRENCY;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const rounded = roundMoney(value);
  const decimals = options.decimals ?? (Number.isInteger(rounded) ? 0 : 2);
  return formatter(locale, currency, decimals).format(rounded).replace(/\s/g, " ");
}

/** Número sin símbolo: 41262 → "41.262". */
export function formatNumber(value: number, locale = DEFAULT_LOCALE, decimals = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Texto → número en formato es-AR (punto = miles, coma = decimales).
 * "12,5" → 12.5 · "12.500" → 12500 · "$ 1.234,50" → 1234.5. NaN si no se puede.
 */
export function parseMoney(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "");
  if (!clean) return Number.NaN;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean.replace(/\.(?=\d{3}(?:\D|$))/g, "");
  return Number(normalized);
}

/** Porcentaje: 10 → "10 %". */
export function formatPercent(value: number, locale = DEFAULT_LOCALE): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} %`;
}
