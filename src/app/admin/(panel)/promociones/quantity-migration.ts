/*
 * ¿Un error al guardar una promo por cantidad (3x2, N.ª unidad) es porque
 * falta la migración 0017? Puro, para testear sin base.
 */

/** `app_meta.schema_version` que deja la migración 0017. */
export const QUANTITY_PROMOS_SCHEMA_VERSION = 8;

export interface DbError {
  code?: string;
  message?: string;
}

/**
 * Criterio principal: la versión del esquema (< 8 → falta 0017; ≥ 8 → el
 * error es otro, por ejemplo `promotions_config_check`). Si no se pudo leer la
 * versión, se mira el error: `PGRST204`/`42703` (la columna `config` no
 * existe) o `23514` sobre el check viejo `promotions_type_check`.
 */
export function isMissingQuantityMigration(schemaVersion: number | null, error: DbError | null): boolean {
  if (!error) return false;
  if (schemaVersion !== null) return schemaVersion < QUANTITY_PROMOS_SCHEMA_VERSION;
  if (error.code === "PGRST204" || error.code === "42703") return /config/i.test(error.message ?? "");
  if (error.code === "23514") return /\bpromotions_type_check\b/.test(error.message ?? "");
  return false;
}
