/*
 * Taller 3D — motor puro (spec docs/modules/TALLER-3D.md §3). El worker de
 * parseo (`worker.ts`) no se reexporta: se instancia con `new Worker(new URL(...))`.
 */
export * from "./types";
export { ModelParseError, analyzeMesh, detectFormat, parse3mf, parseModel, parseStl, scaleGeometry, suggestUnit, unitFactor } from "./mesh";
export { MAX_DIMENSION_MM, fitsPrinter, geometryIsPlausible } from "./geometry";
export {
  MIN_AUTO_VOLUME_MM3,
  REVIEW_REASON_LABELS,
  STOCK_MARGIN,
  calibrationFor,
  ceilTo,
  priceItem,
  quoteTotals,
  reviewReasons,
} from "./pricing";
export type { PriceContext, ReviewContext } from "./pricing";
export { PRINT3D_TIMEZONE, estimateReadyDate } from "./schedule";
export { averageCostPerGram, jobCost, sumCosts } from "./cost";
export {
  CALIBRATION_MAX,
  CALIBRATION_MAX_SAMPLES,
  CALIBRATION_MIN,
  CALIBRATION_MIN_SAMPLES,
  calibrationFactor,
} from "./calibration";
export { round2, roundTo } from "./round";
