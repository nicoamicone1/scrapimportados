/*
 * Taller 3D — chequeos de geometría (spec §3.2). `geometryIsPlausible` tiene
 * un espejo idéntico en SQL: no cambiar uno sin el otro.
 */
import type { Geometry } from "./types";

/** Medida máxima aceptada en cualquier eje (mm). */
export const MAX_DIMENSION_MM = 2000;

/**
 * Todo finito y > 0; el volumen entra en la caja (+0,1 %); el área no es
 * menor que la de una esfera del mismo volumen (−1 %); ≥ 4 triángulos;
 * ninguna medida mayor a 2000 mm.
 */
export function geometryIsPlausible(g: Geometry): boolean {
  const { volume_mm3: v, area_mm2: a, bbox, triangles } = g;
  const values = [v, a, bbox[0], bbox[1], bbox[2], triangles];
  if (!values.every((x) => Number.isFinite(x) && x > 0)) return false;
  if (v > bbox[0] * bbox[1] * bbox[2] * 1.001) return false;
  if (a < Math.cbrt(36 * Math.PI * v * v) * 0.99) return false;
  if (triangles < 4) return false;
  return Math.max(bbox[0], bbox[1], bbox[2]) <= MAX_DIMENSION_MM;
}

function sorted3(v: [number, number, number]): [number, number, number] {
  return [...v].sort((a, b) => a - b) as [number, number, number];
}

/**
 * ¿Entra en la cama? Prueba las 6 rotaciones de ejes: ordenar pieza y cama
 * de menor a mayor y comparar componente a componente es equivalente.
 */
export function fitsPrinter(bbox: [number, number, number], bed: [number, number, number]): boolean {
  const p = sorted3(bbox);
  const b = sorted3(bed);
  return p[0] <= b[0] && p[1] <= b[1] && p[2] <= b[2];
}
