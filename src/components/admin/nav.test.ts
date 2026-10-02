import { describe, expect, it } from "vitest";

import { buildNav, isNavActive, MOBILE_TABS, NAV, navItemFor, sectionFor } from "./nav";

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

describe("buildNav", () => {
  it("sin apps devuelve el menú fijo, con el ítem Apps en Sistema", () => {
    expect(buildNav([])).toBe(NAV);
    const system = NAV.find((g) => g.section === "system")!;
    expect(system.items.some((i) => i.href === "/admin/apps")).toBe(true);
  });

  it("con una app vigente suma el grupo Apps justo antes de Sistema", () => {
    const groups = buildNav(["print3d"]);
    expect(groups).toHaveLength(NAV.length + 1);
    const at = groups.findIndex((g) => g.label === "Apps");
    expect(groups[at + 1].section).toBe("system");
    expect(groups[at].items.map((i) => i.href)).toEqual([
      "/admin/taller-3d",
      "/admin/taller-3d/cola",
      "/admin/taller-3d/cotizaciones",
      "/admin/taller-3d/filamento",
    ]);
    // No muta el menú fijo.
    expect(NAV.some((g) => g.label === "Apps")).toBe(false);
  });

  it("las rutas de la app resuelven activo, breadcrumb y tinta", () => {
    const apps = buildNav(["print3d"]).find((g) => g.label === "Apps")!;
    const home = apps.items.find((i) => i.href === "/admin/taller-3d")!;
    expect(isNavActive(home, "/admin/taller-3d")).toBe(true);
    expect(isNavActive(home, "/admin/taller-3d/cola")).toBe(false);
    expect(navItemFor("/admin/taller-3d/cola")?.item.href).toBe("/admin/taller-3d/cola");
    expect(navItemFor("/admin/taller-3d/impresoras")?.item.href).toBe("/admin/taller-3d");
    expect(navItemFor("/admin/taller-3d")?.group.label).toBe("Apps");
    expect(sectionFor("/admin/taller-3d/configuracion")).toBe("store");
    expect(navItemFor("/admin/taller-3dx")).toBeNull();
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
