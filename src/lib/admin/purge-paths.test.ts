import { describe, expect, it } from "vitest";

import { chunk, collectStoragePaths, purgeConfirmMatches, STORAGE_PAGE, type StorageEntry } from "./purge-paths";

const S = "3bb3f37f-4fbf-4402-a7d8-e225337498fb";

function fakeBucket(tree: Record<string, StorageEntry[]>) {
  const calls: string[] = [];
  return {
    calls,
    list: async (prefix: string, offset: number, limit: number) => {
      calls.push(`${prefix}@${offset}`);
      return (tree[prefix] ?? []).slice(offset, offset + limit);
    },
  };
}

describe("borrar tienda · fotos del bucket", () => {
  it("recorre las subcarpetas y devuelve sólo archivos", async () => {
    const b = fakeBucket({
      [S]: [
        { name: "brand", id: null },
        { name: "products", id: null },
        { name: "suelto.webp", id: "1" },
      ],
      [`${S}/brand`]: [{ name: "logo.png", id: "2" }],
      [`${S}/products`]: [{ name: "vestido", id: null }],
      [`${S}/products/vestido`]: [
        { name: "1.webp", id: "3" },
        { name: "2.webp", id: "4" },
      ],
    });
    const paths = await collectStoragePaths(`${S}/`, b.list);
    expect(paths.sort()).toEqual([`${S}/brand/logo.png`, `${S}/products/vestido/1.webp`, `${S}/products/vestido/2.webp`, `${S}/suelto.webp`].sort());
  });

  it("pagina cuando una carpeta tiene más de una página", async () => {
    const many = Array.from({ length: STORAGE_PAGE + 3 }, (_, i) => ({ name: `f${i}.webp`, id: String(i) }));
    const b = fakeBucket({ [S]: many });
    const paths = await collectStoragePaths(S, b.list);
    expect(paths).toHaveLength(STORAGE_PAGE + 3);
    expect(b.calls).toEqual([`${S}@0`, `${S}@${STORAGE_PAGE}`]);
  });

  it("una tienda sin fotos no lista nada más", async () => {
    const b = fakeBucket({});
    expect(await collectStoragePaths(S, b.list)).toEqual([]);
  });

  it("chunk parte en lotes", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("borrar tienda · confirmación", () => {
  it("pide la dirección exacta, sin importar mayúsculas ni espacios", () => {
    expect(purgeConfirmMatches("  ElFaro ", "elfaro")).toBe(true);
    expect(purgeConfirmMatches("el faro", "elfaro")).toBe(false);
    expect(purgeConfirmMatches("", "elfaro")).toBe(false);
  });
});
