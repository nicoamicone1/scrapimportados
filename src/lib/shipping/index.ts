import "server-only";

/**
 * Punto de entrada de envíos para código de SERVIDOR (server actions del
 * checkout, route handlers). Reexporta todo, incluido `geocode` (server-only).
 *
 * En Client Components importá los módulos puros directamente:
 *   import { resolveZone } from "@/lib/shipping/resolve";
 *   import { PROVINCE_OPTIONS } from "@/lib/shipping/provinces";
 */
export * from "./provinces";
export * from "./geometry";
export * from "./resolve";
export * from "./geocode";
export * from "./quote";
export { CABA_POLYGON, EXAMPLE_ZONES, EXAMPLE_PICKUP } from "./examples";
