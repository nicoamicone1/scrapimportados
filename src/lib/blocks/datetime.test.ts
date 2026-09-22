import { describe, expect, it } from "vitest";

import { isoToZonedLocal, zonedLocalToIso } from "./datetime";

const BA = "America/Argentina/Buenos_Aires";

describe("fechas en la zona de la tienda", () => {
  it("convierte hora de Buenos Aires (UTC−3) a ISO y vuelta", () => {
    expect(zonedLocalToIso("2026-11-30T23:59", BA)).toBe("2026-12-01T02:59:00.000Z");
    expect(isoToZonedLocal("2026-12-01T02:59:00.000Z", BA)).toBe("2026-11-30T23:59");
  });

  it("respeta otras zonas y el horario de verano", () => {
    expect(zonedLocalToIso("2026-07-01T12:00", "Europe/Madrid")).toBe("2026-07-01T10:00:00.000Z");
    expect(zonedLocalToIso("2026-01-15T12:00", "Europe/Madrid")).toBe("2026-01-15T11:00:00.000Z");
  });

  it("rechaza valores inválidos", () => {
    expect(zonedLocalToIso("mañana", BA)).toBeNull();
    expect(isoToZonedLocal("no-es-fecha", BA)).toBe("");
  });
});
