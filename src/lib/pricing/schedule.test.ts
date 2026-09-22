import { describe, expect, it } from "vitest";

import { isoToZonedLocal, scheduleStatus, zonedLocalToIso } from "./schedule";

const NOW = new Date("2026-09-22T12:00:00Z");
const BA = "America/Argentina/Buenos_Aires";

describe("scheduleStatus", () => {
  it("activa sin fechas", () => {
    expect(scheduleStatus({ isActive: true }, NOW)).toBe("active");
  });
  it("programada si empieza en el futuro", () => {
    expect(scheduleStatus({ isActive: true, startsAt: "2026-10-01T00:00:00Z" }, NOW)).toBe("scheduled");
  });
  it("vencida si terminó (aunque esté pausada)", () => {
    expect(scheduleStatus({ isActive: true, endsAt: "2026-09-01T00:00:00Z" }, NOW)).toBe("expired");
    expect(scheduleStatus({ isActive: false, endsAt: "2026-09-01T00:00:00Z" }, NOW)).toBe("expired");
  });
  it("pausada si is_active = false y no venció", () => {
    expect(scheduleStatus({ isActive: false, startsAt: "2026-10-01T00:00:00Z" }, NOW)).toBe("paused");
    expect(scheduleStatus({ isActive: false }, NOW)).toBe("paused");
  });
  it("dentro de la ventana está activa", () => {
    expect(scheduleStatus({ isActive: true, startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" }, NOW)).toBe("active");
  });
});

describe("zonas horarias", () => {
  it("hora de Buenos Aires → UTC (UTC−3)", () => {
    expect(zonedLocalToIso("2026-11-02T00:00", BA)).toBe("2026-11-02T03:00:00.000Z");
    expect(zonedLocalToIso("2026-12-31T23:59", BA)).toBe("2027-01-01T02:59:00.000Z");
  });
  it("UTC → hora de Buenos Aires", () => {
    expect(isoToZonedLocal("2026-11-02T03:00:00.000Z", BA)).toBe("2026-11-02T00:00");
    expect(isoToZonedLocal("2027-01-01T02:59:00Z", BA)).toBe("2026-12-31T23:59");
  });
  it("ida y vuelta con horario de verano (Madrid)", () => {
    const tz = "Europe/Madrid";
    expect(zonedLocalToIso("2026-07-01T10:00", tz)).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedLocalToIso("2026-01-15T10:00", tz)).toBe("2026-01-15T09:00:00.000Z");
    expect(isoToZonedLocal(zonedLocalToIso("2026-03-29T12:30", tz), tz)).toBe("2026-03-29T12:30");
  });
  it("vacío o inválido", () => {
    expect(zonedLocalToIso("", BA)).toBeNull();
    expect(zonedLocalToIso(null, BA)).toBeNull();
    expect(zonedLocalToIso("mañana", BA)).toBeNull();
    expect(isoToZonedLocal(null, BA)).toBe("");
    expect(isoToZonedLocal("no-es-fecha", BA)).toBe("");
  });
});
