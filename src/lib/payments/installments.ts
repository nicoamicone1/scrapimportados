/*
 * Cuotas sin interés en la tienda (cliente y servidor). Sólo comunica lo que
 * el comercio activó en su cuenta de Mercado Pago (docs/PAYMENTS.md §6).
 */

import { formatMoney } from "@/lib/money";

export const FREE_INSTALLMENT_OPTIONS = [0, 3, 6, 9, 12] as const;
export type FreeInstallments = (typeof FREE_INSTALLMENT_OPTIONS)[number];

/** Valor de cada cuota, redondeado hacia arriba al centavo (nunca promete de menos). */
export function installmentAmount(price: number, n: number): number {
  if (!(price > 0) || !(n > 0)) return 0;
  return Math.ceil(Number(((price * 100) / n).toFixed(6))) / 100;
}

/** "3 cuotas sin interés de $1.234,00" ("" si no aplica). */
export function installmentLabel(price: number, n: number, opts: { currency?: string; locale?: string } = {}): string {
  if (!(n > 1) || !(price > 0)) return "";
  return `${n} cuotas sin interés de ${formatMoney(installmentAmount(price, n), opts)}`;
}

export function normalizeFreeInstallments(value: unknown): FreeInstallments {
  const n = Number(value);
  return (FREE_INSTALLMENT_OPTIONS as readonly number[]).includes(n) ? (n as FreeInstallments) : 0;
}

export function normalizeMaxInstallments(value: unknown): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 24 ? n : 12;
}
