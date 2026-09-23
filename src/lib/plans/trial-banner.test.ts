import { describe, expect, it } from "vitest";

import { getPlanChip } from "./chip";
import { freeLimitsText, trialBannerState } from "./trial-banner";

// 12:00 en Buenos Aires (UTC-3).
const NOW = new Date("2026-09-23T15:00:00Z");
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe("trialBannerState", () => {
  it("más de 3 días de prueba: tono neutro, días y fecha de corte", () => {
    const s = trialBannerState({ status: "trialing", trialEndsAt: inHours(24 * 9), planCode: "pro", now: NOW });
    expect(s).toMatchObject({ kind: "trial", tone: "neutral", daysLeft: 9, endsOn: null, endsAtDate: "2 de octubre" });
    if (s.kind === "trial") expect(s.message).toBe("Te quedan 9 días de Pro gratis (hasta el 2 de octubre).");
  });

  it("usa los mismos días que el chip del sidebar", () => {
    const trialEndsAt = inHours(24 * 5 + 3);
    const s = trialBannerState({ status: "trialing", trialEndsAt, planCode: "pro", now: NOW });
    const chip = getPlanChip({ plan: { name: "Pro", status: "trialing", trialEndsAt } }, NOW);
    expect(s.kind === "trial" && s.daysLeft).toBe(6);
    expect(chip.label).toBe("Prueba Pro · 6 días");
  });

  it("entre 3 y 2 días: ámbar", () => {
    expect(trialBannerState({ status: "trialing", trialEndsAt: inHours(72), planCode: "pro", now: NOW })).toMatchObject({ tone: "warning", daysLeft: 3 });
    expect(trialBannerState({ status: "trialing", trialEndsAt: inHours(25), planCode: "pro", now: NOW })).toMatchObject({ tone: "warning", daysLeft: 2 });
    expect(trialBannerState({ status: "trialing", trialEndsAt: inHours(73), planCode: "pro", now: NOW })).toMatchObject({ tone: "neutral", daysLeft: 4 });
  });

  it("últimas 24 h con corte el mismo día: 'termina hoy a las …'", () => {
    const s = trialBannerState({ status: "trialing", trialEndsAt: inHours(6.5), planCode: "pro", now: NOW });
    expect(s).toMatchObject({ kind: "trial", tone: "urgent", endsOn: "today", endsAtTime: "18:30" });
    if (s.kind === "trial") expect(s.message).toBe("Tu prueba de Pro termina hoy a las 18:30.");
  });

  it("últimas 24 h con corte pasada la medianoche: 'mañana a las …'", () => {
    const s = trialBannerState({ status: "trialing", trialEndsAt: inHours(20), planCode: "pro", now: NOW });
    expect(s).toMatchObject({ tone: "urgent", endsOn: "tomorrow", endsAtTime: "08:00" });
  });

  it("respeta la zona horaria de la tienda", () => {
    const s = trialBannerState({ status: "trialing", trialEndsAt: inHours(6.5), planCode: "pro", now: NOW, timeZone: "UTC" });
    expect(s).toMatchObject({ endsAtTime: "21:30", endsOn: "today" });
  });

  it("prueba vencida sin barrer: Free después de la prueba", () => {
    const s = trialBannerState({ status: "trialing", trialEndsAt: inHours(-1), planCode: "pro", now: NOW });
    expect(s).toEqual({
      kind: "free",
      afterTrial: true,
      message: "Terminó tu prueba y la tienda pasó a Free: hasta 50 productos y sólo la portada en el editor.",
    });
  });

  it("Free: franja discreta con los límites; afterTrial si se sabe que venció la prueba", () => {
    expect(trialBannerState({ status: "active", trialEndsAt: null, planCode: "free", now: NOW })).toEqual({
      kind: "free",
      afterTrial: false,
      message: "Estás en Free: hasta 50 productos y sólo la portada en el editor.",
    });
    expect(trialBannerState({ status: "active", trialEndsAt: null, planCode: "free", trialExpired: true, now: NOW })).toMatchObject({
      afterTrial: true,
    });
    expect(trialBannerState({ status: "cancelled", trialEndsAt: null, planCode: "free", now: NOW }).kind).toBe("free");
  });

  it("planes pagos activos o con pago pendiente: no molesta", () => {
    for (const planCode of ["starter", "pro", "business"] as const) {
      expect(trialBannerState({ status: "active", trialEndsAt: null, planCode, now: NOW })).toEqual({ kind: "none" });
      expect(trialBannerState({ status: "past_due", trialEndsAt: null, planCode, now: NOW })).toEqual({ kind: "none" });
    }
  });

  it("fecha inválida: nada", () => {
    expect(trialBannerState({ status: "trialing", trialEndsAt: "no-es-fecha", planCode: "pro", now: NOW })).toEqual({ kind: "none" });
  });
});

describe("freeLimitsText", () => {
  it("usa los límites del plan", () => {
    expect(freeLimitsText({ products: 50, pages: 1 })).toBe("hasta 50 productos y sólo la portada en el editor");
    expect(freeLimitsText({ products: 1000, pages: 3 })).toBe("hasta 1.000 productos y 3 páginas en el editor");
    expect(freeLimitsText({ products: null, pages: null })).toBe("");
  });
});
