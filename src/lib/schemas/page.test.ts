import { describe, expect, it } from "vitest";

import { pageSlugError } from "./page";

describe("slugs reservados de páginas", () => {
  it("rutas de metadata de Next (íconos e imagen para compartir) no se pueden usar", () => {
    for (const slug of ["icon", "apple-icon", "opengraph-image", "opengraph-image-1a2b3c"]) {
      expect(pageSlugError(slug)).toContain("lo usa la tienda");
    }
  });

  it("los parecidos siguen siendo válidos", () => {
    expect(pageSlugError("iconos")).toBeNull();
    expect(pageSlugError("nosotros")).toBeNull();
  });
});
