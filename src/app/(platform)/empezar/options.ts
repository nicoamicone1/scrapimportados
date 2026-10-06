import type { StoreKind } from "@/lib/tenant/kinds";

/*
 * Opciones del formulario de /empezar. Aparte de `lead.ts` para que el
 * componente cliente no arrastre el maquetado de mails.
 */

/** "¿Cuántos productos vendés hoy?" */
export const CATALOG_SIZES = [
  { id: "hasta-30", label: "Hasta 30" },
  { id: "30-100", label: "30 a 100" },
  { id: "100-300", label: "100 a 300" },
  { id: "mas-300", label: "Más de 300" },
] as const;

export type CatalogSize = (typeof CATALOG_SIZES)[number]["id"];

/** El rubro con el que arranca el formulario: el ICP es ropa (PLAN-GTM §3). */
export const DEFAULT_KIND: StoreKind = "moda";
