import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createPublicClient: vi.fn() }));

import { isMissingTiersColumn, withTiersColumn } from "./products";

type Res = { data: string | null; error: { code?: string; message?: string } | null };

const MISSING_PG = { code: "42703", message: "column products.price_tiers does not exist" };
const MISSING_EMBED = { code: "42703", message: "column products_1.price_tiers does not exist" };
const MISSING_REST = { code: "PGRST204", message: "Could not find the 'price_tiers' column of 'products' in the schema cache" };

describe("precios por cantidad sin la migración 0021", () => {
  it("reconoce la columna faltante (Postgres, embebido y PostgREST) y nada más", () => {
    expect(isMissingTiersColumn(MISSING_PG)).toBe(true);
    expect(isMissingTiersColumn(MISSING_EMBED)).toBe(true);
    expect(isMissingTiersColumn(MISSING_REST)).toBe(true);
    expect(isMissingTiersColumn(null)).toBe(false);
    // Otra columna u otro error: no se reintenta sin tramos.
    expect(isMissingTiersColumn({ code: "42703", message: "column products.foo does not exist" })).toBe(false);
    expect(isMissingTiersColumn({ code: "57014", message: "canceling statement due to statement timeout (price_tiers)" })).toBe(false);
  });

  it("con la columna, una sola consulta con tramos", async () => {
    const run = vi.fn(async (tiers: boolean): Promise<Res> => ({ data: tiers ? "con" : "sin", error: null }));
    await expect(withTiersColumn(run)).resolves.toEqual({ data: "con", error: null });
    expect(run.mock.calls).toEqual([[true]]);
  });

  it("sin la columna repite sin tramos, y NO lo memoriza: aplicada 0021, la próxima lectura ya los trae", async () => {
    let applied = false;
    const run = vi.fn(async (tiers: boolean): Promise<Res> =>
      tiers && !applied ? { data: null, error: MISSING_EMBED } : { data: tiers ? "con" : "sin", error: null },
    );
    await expect(withTiersColumn(run)).resolves.toEqual({ data: "sin", error: null });
    expect(run.mock.calls).toEqual([[true], [false]]);

    applied = true;
    run.mockClear();
    await expect(withTiersColumn(run)).resolves.toEqual({ data: "con", error: null });
    expect(run.mock.calls).toEqual([[true]]);
  });

  it("otro error se devuelve tal cual (sin reintentar)", async () => {
    const error = { code: "PGRST301", message: "JWT expired" };
    const run = vi.fn(async (): Promise<Res> => ({ data: null, error }));
    await expect(withTiersColumn(run)).resolves.toEqual({ data: null, error });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
