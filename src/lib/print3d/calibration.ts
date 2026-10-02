/*
 * Taller 3D — autocalibración (spec §3.7). Espejo del SQL de
 * `print3d_finish_job`: no cambiar uno sin el otro.
 */
import { roundTo } from "./round";
import type { CalibrationSample } from "./types";

export const CALIBRATION_MAX_SAMPLES = 20;
export const CALIBRATION_MIN_SAMPLES = 3;
export const CALIBRATION_MIN = 0.5;
export const CALIBRATION_MAX = 2;

/**
 * Mediana de `actual / raw` de las primeras 20 muestras válidas (raw > 0;
 * pasarlas de la más nueva a la más vieja), acotada a [0,5; 2] y redondeada
 * a 3 decimales como la columna. Con menos de 3 muestras → 1.
 */
export function calibrationFactor(samples: CalibrationSample[]): number {
  const ratios = samples
    .filter((s) => Number.isFinite(s.actual) && s.actual >= 0 && Number.isFinite(s.raw) && s.raw > 0)
    .slice(0, CALIBRATION_MAX_SAMPLES)
    .map((s) => s.actual / s.raw)
    .sort((a, b) => a - b);
  const n = ratios.length;
  if (n < CALIBRATION_MIN_SAMPLES) return 1;
  const median = n % 2 === 1 ? ratios[(n - 1) / 2] : (ratios[n / 2 - 1] + ratios[n / 2]) / 2;
  return roundTo(Math.min(CALIBRATION_MAX, Math.max(CALIBRATION_MIN, median)), 3);
}
