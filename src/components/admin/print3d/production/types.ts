import type { CatalogRef, Job } from "@/lib/admin/print3d-production";
import type { MaterialType } from "@/lib/print3d/types";

/* Datos serializables que el server le pasa al tablero (cliente). */

export interface BoardPrinter {
  id: string;
  name: string;
  model: string | null;
  color: string;
  status: "active" | "maintenance" | "inactive";
  bed: [number, number, number];
  materials: MaterialType[];
}

export interface BoardSpool {
  id: string;
  color_id: string;
  brand: string | null;
  remaining_grams: number;
  net_grams: number;
  status: "sealed" | "open" | "empty";
}

export interface BoardData {
  jobs: Job[];
  printers: BoardPrinter[];
  catalog: CatalogRef;
  spools: BoardSpool[];
  /** Hoy en la zona de la tienda (YYYY-MM-DD). */
  today: string;
  /** Hora del server al renderizar (arranque del reloj del tablero). */
  nowIso: string;
  dailyPrintHours: number;
}

export type { Job };

/** Material + color + calidad de un trabajo, resueltos para mostrar. */
export interface JobLook {
  materialType: MaterialType | null;
  materialName: string | null;
  colorName: string | null;
  hex: string | null;
  qualityName: string | null;
}

export function lookFor(job: Pick<Job, "material_id" | "color_id" | "quality_id">, catalog: CatalogRef): JobLook {
  const m = job.material_id ? catalog.materials.find((x) => x.id === job.material_id) : undefined;
  const c = job.color_id ? catalog.colors.find((x) => x.id === job.color_id) : undefined;
  const q = job.quality_id ? catalog.qualities.find((x) => x.id === job.quality_id) : undefined;
  return {
    materialType: m?.type ?? null,
    materialName: m?.name ?? null,
    colorName: c?.name ?? null,
    hex: c?.hex ?? null,
    qualityName: q?.name ?? null,
  };
}
