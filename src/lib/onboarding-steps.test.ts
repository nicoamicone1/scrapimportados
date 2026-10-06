import { describe, expect, it } from "vitest";

import { buildOnboardingSteps, ONBOARDING_ORDER, type OnboardingFacts } from "./onboarding-steps";

const facts: OnboardingFacts = {
  products: 0,
  deliveryOptions: 0,
  hasBank: false,
  hasWhatsApp: false,
  homeEdited: false,
  appearance: false,
  shared: false,
  storeUrl: "https://tienda-luna.ecommy.app",
  storeHost: "tienda-luna.ecommy.app",
  variants: true,
  maintenance: false,
};

describe("primeros pasos", () => {
  it("van en el orden de quien vende por redes: productos, cobros, compartir y después el resto", () => {
    expect(ONBOARDING_ORDER).toEqual(["products", "payments", "shared", "shipping", "appearance", "home"]);
    expect(buildOnboardingSteps(facts).map((s) => s.id)).toEqual([...ONBOARDING_ORDER]);
    expect(buildOnboardingSteps(facts)[1].title).toBe("Definí cómo cobrás");
  });

  it("se tildan con los datos de la tienda", () => {
    const steps = buildOnboardingSteps({ ...facts, products: 3, hasWhatsApp: true, deliveryOptions: 1, shared: true });
    expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual(["products", "payments", "shared", "shipping"]);
  });

  it("compartir dice que la tienda ya está publicada y trae el texto para la historia", () => {
    const share = buildOnboardingSteps(facts).find((s) => s.id === "shared")!;
    expect(share.description).toContain("ya está publicada en tienda-luna.ecommy.app");
    expect(share.shareText).toBe(
      "Ahora podés pedir directo acá: https://tienda-luna.ecommy.app. Elegís talle y color y te llega el total.",
    );
  });

  it("sin variantes no habla de talles, y con mantenimiento avisa", () => {
    const plain = buildOnboardingSteps({ ...facts, variants: false }).find((s) => s.id === "shared")!;
    expect(plain.shareText).not.toContain("talle");
    const paused = buildOnboardingSteps({ ...facts, maintenance: true }).find((s) => s.id === "shared")!;
    expect(paused.description).toContain("modo mantenimiento");
    expect(paused.description).not.toContain("ya está publicada");
  });
});
