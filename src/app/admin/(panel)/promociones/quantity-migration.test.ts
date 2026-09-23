import { describe, expect, it } from "vitest";

import { isMissingQuantityMigration } from "./quantity-migration";

const typeCheck = { code: "23514", message: 'new row for relation "promotions" violates check constraint "promotions_type_check"' };
const configCheck = { code: "23514", message: 'new row for relation "promotions" violates check constraint "promotions_config_check"' };
const noColumn = { code: "PGRST204", message: "Could not find the 'config' column of 'promotions' in the schema cache" };

describe("isMissingQuantityMigration", () => {
  it("sin error, nunca", () => {
    expect(isMissingQuantityMigration(5, null)).toBe(false);
    expect(isMissingQuantityMigration(null, null)).toBe(false);
  });

  it("con la versión del esquema, manda la versión", () => {
    expect(isMissingQuantityMigration(7, configCheck)).toBe(true);
    expect(isMissingQuantityMigration(8, typeCheck)).toBe(false);
    expect(isMissingQuantityMigration(9, noColumn)).toBe(false);
  });

  it("sin versión: columna config inexistente → falta 0017", () => {
    expect(isMissingQuantityMigration(null, noColumn)).toBe(true);
    expect(isMissingQuantityMigration(null, { code: "42703", message: 'column "config" of relation "promotions" does not exist' })).toBe(true);
  });

  it("sin versión: sólo el check viejo de type cuenta, no el de config", () => {
    expect(isMissingQuantityMigration(null, typeCheck)).toBe(true);
    expect(isMissingQuantityMigration(null, configCheck)).toBe(false);
    expect(isMissingQuantityMigration(null, { code: "23514", message: "config type_check" })).toBe(false);
  });

  it("otros errores no son la migración", () => {
    expect(isMissingQuantityMigration(null, { code: "42501", message: "permission denied" })).toBe(false);
  });
});
