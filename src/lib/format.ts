/**
 * Helpers de formato puros (sin dependencias de Node): se pueden usar
 * tanto en Server Components como en Client Components.
 */

const arsNumber = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** 35880 -> "$ 35.880" */
export function formatARS(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `$ ${arsNumber.format(Math.round(value))}`;
}

/**
 * Igual que `formatARS` pero con espacio fino irrompible (U+202F) entre el
 * "$" y el número: en las tarjetas el símbolo nunca queda colgado en su
 * propia línea. Es el que se usa en toda la UI; `formatARS` queda para el
 * texto plano del mensaje de WhatsApp.
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `$\u202f${arsNumber.format(Math.round(value))}`;
}

/** ISO -> "19/08/2026, 15:45" (hora de Argentina) */
export function formatDateAR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

/**
 * Minúsculas y sin acentos: buscar "lampara" y que matchee "lámpara".
 * También se usa para elegir el icono de cada categoría.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Los productos variables muestran "desde $ ...". */
export function isVariable(product: { type: string }): boolean {
  return product.type === "variable";
}
