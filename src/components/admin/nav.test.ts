import { describe, expect, it } from "vitest";

import { isNavActive, MOBILE_TABS, NAV, navItemFor } from "./nav";

const find = (href: string) => NAV.flatMap((g) => g.items).find((i) => i.href === href)!;

describe("isNavActive", () => {
  it("resalta sólo el ítem más específico cuando hay rutas anidadas", () => {
    expect(isNavActive(find("/admin/inventario/avisos"), "/admin/inventario/avisos")).toBe(true);
    expect(isNavActive(find("/admin/inventario"), "/admin/inventario/avisos")).toBe(false);
    expect(isNavActive(find("/admin/inventario"), "/admin/inventario/movimientos")).toBe(true);
    expect(isNavActive(find("/admin/inventario"), "/admin/inventario")).toBe(true);
  });

  it("el dashboard es exacto y los externos nunca se marcan", () => {
    expect(isNavActive(find("/admin"), "/admin")).toBe(true);
    expect(isNavActive(find("/admin"), "/admin/pedidos")).toBe(false);
    const external = NAV.flatMap((g) => g.items).find((i) => i.external);
    if (external) expect(isNavActive(external, external.href)).toBe(false);
  });

  it("navItemFor devuelve el ítem más específico", () => {
    expect(navItemFor("/admin/inventario/avisos")?.item.href).toBe("/admin/inventario/avisos");
    expect(navItemFor("/admin/inventario/movimientos")?.item.href).toBe("/admin/inventario");
  });
});

describe("MOBILE_TABS", () => {
  it("cada pestaña de la barra inferior existe en el menú", () => {
    for (const tab of MOBILE_TABS) expect(find(tab.href)).toBeTruthy();
    expect(MOBILE_TABS.length).toBeLessThanOrEqual(4);
  });

  it("importar vive en Catálogo", () => {
    expect(navItemFor("/admin/importar")?.group.section).toBe("catalog");
  });
});
