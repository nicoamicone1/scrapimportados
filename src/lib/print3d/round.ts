/*
 * Redondeos decimales del Taller 3D. Se corre la coma con la notación
 * exponencial (no multiplicando) para que 1.005 → 1.01 igual que `round()`
 * de Postgres sobre numeric (mitad hacia afuera del cero).
 */

/** x · 10^d sin error binario (1.005 → 100.5, no 100.49999). */
function shift(x: number, d: number): number {
  const [mantissa, exp] = x.toExponential().split("e");
  return Number(`${mantissa}e${Number(exp) + d}`);
}

/** Redondeo a `decimals` decimales, mitad hacia afuera del cero (como Postgres). */
export function roundTo(x: number, decimals: number): number {
  if (!Number.isFinite(x) || x === 0) return x === 0 ? 0 : x;
  const sign = x < 0 ? -1 : 1;
  const scaled = Math.round(shift(Math.abs(x), decimals));
  return sign * shift(scaled, -decimals) || 0;
}

/**
 * Redondeo a 2 decimales para gramos, minutos y plata. Primero limpia el
 * ruido binario a 8 decimales (1711.4249999999997 → 1711.425) y después
 * redondea. Espejo SQL: `round(round(x, 8), 2)` — numeric NO es exacto al
 * dividir (40.00/60 = 0.66666666666666666667), así que SQL también limpia a 8.
 */
export function round2(x: number): number {
  return roundTo(roundTo(x, 8), 2);
}

/**
 * Múltiplo de `r` más chico que es ≥ x, en enteros escalados a 1e-8 (sin
 * errores de coma flotante: 1100.0000000000002 no salta a 1200).
 * Espejo SQL: `ceil(round(x, 8) / r) * r`.
 */
export function ceilMultiple(x: number, r: number): number {
  const X = Math.round(shift(x, 8));
  const R = Math.round(shift(r, 8));
  let q = Math.ceil(X / R);
  while (q * R < X) q++;
  while ((q - 1) * R >= X) q--;
  return round2(q * r);
}
