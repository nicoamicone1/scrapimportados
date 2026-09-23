import { describe, expect, it } from "vitest";

import { classifyHost, hostnameOf, parseStorePath } from "./host";
import { RESERVED_STORE_SLUGS, storeSlugProblem, toStoreSlug } from "./slug";

describe("hostnameOf", () => {
  it("normaliza puerto, mayúsculas y punto final", () => {
    expect(hostnameOf("Demo.Ecommy.App:443")).toBe("demo.ecommy.app");
    expect(hostnameOf("ecommy.app.")).toBe("ecommy.app");
    expect(hostnameOf("[::1]:3000")).toBe("[::1]");
    expect(hostnameOf(null)).toBe("");
  });
});

describe("classifyHost", () => {
  const root = "ecommy.app";

  it("dominio raíz y www → plataforma", () => {
    expect(classifyHost("ecommy.app", root)).toEqual({ kind: "platform" });
    expect(classifyHost("www.ecommy.app", root)).toEqual({ kind: "platform" });
    expect(classifyHost("ECOMMY.APP:443", root)).toEqual({ kind: "platform" });
  });

  it("subdominio → tienda", () => {
    expect(classifyHost("taller-luna.ecommy.app", root)).toEqual({ kind: "store", slug: "taller-luna" });
    expect(classifyHost("demo.ecommy.app", root)).toEqual({ kind: "store", slug: "demo" });
  });

  it("subdominios reservados o anidados → plataforma", () => {
    expect(classifyHost("app.ecommy.app", root)).toEqual({ kind: "platform" });
    expect(classifyHost("admin.ecommy.app", root)).toEqual({ kind: "platform" });
    expect(classifyHost("a.b.ecommy.app", root)).toEqual({ kind: "platform" });
  });

  it("otro dominio → dominio propio", () => {
    expect(classifyHost("tienda.lunaceramica.com.ar", root)).toEqual({ kind: "custom", domain: "tienda.lunaceramica.com.ar" });
    // Parecido pero no subdominio.
    expect(classifyHost("notecommy.app", root)).toEqual({ kind: "custom", domain: "notecommy.app" });
  });

  it("hosts de desarrollo y preview → fallback", () => {
    expect(classifyHost("localhost:3110", "localhost:3000")).toEqual({ kind: "platform" });
    expect(classifyHost("localhost:3110", root)).toEqual({ kind: "fallback" });
    expect(classifyHost("127.0.0.1:3000", root)).toEqual({ kind: "fallback" });
    expect(classifyHost("scrapimportados-git-main-nico.vercel.app", "ecommy-app.vercel.app")).toEqual({ kind: "fallback" });
    expect(classifyHost("", root)).toEqual({ kind: "fallback" });
  });

  it("dominio raíz en vercel.app (sin wildcard): el raíz es plataforma", () => {
    expect(classifyHost("ecommy-app.vercel.app", "ecommy-app.vercel.app")).toEqual({ kind: "platform" });
  });

  it("<slug>.localhost → tienda (Chrome resuelve *.localhost)", () => {
    expect(classifyHost("demo.localhost:3110", "localhost:3000")).toEqual({ kind: "store", slug: "demo" });
    expect(classifyHost("taller-luna.localhost", root)).toEqual({ kind: "store", slug: "taller-luna" });
  });
});

describe("parseStorePath", () => {
  it("extrae slug y resto", () => {
    expect(parseStorePath("/s/demo")).toEqual({ slug: "demo", rest: "/" });
    expect(parseStorePath("/s/demo/")).toEqual({ slug: "demo", rest: "/" });
    expect(parseStorePath("/s/taller-luna/producto/jarra")).toEqual({ slug: "taller-luna", rest: "/producto/jarra" });
  });
  it("ignora paths que no son de tienda", () => {
    expect(parseStorePath("/admin")).toBeNull();
    expect(parseStorePath("/s")).toBeNull();
    expect(parseStorePath("/s/Mal_Slug/x")).toBeNull();
    expect(parseStorePath("/store/demo")).toBeNull();
  });
});

describe("slug de tienda (espejo de check_store_slug)", () => {
  it("formato y largo", () => {
    expect(storeSlugProblem("taller-luna")).toBeNull();
    expect(storeSlugProblem("")).toBe("empty");
    expect(storeSlugProblem("ab")).toBe("short");
    expect(storeSlugProblem("a".repeat(41))).toBe("long");
    expect(storeSlugProblem("Taller")).toBe("format");
    expect(storeSlugProblem("-taller")).toBe("format");
    expect(storeSlugProblem("taller--luna")).toBe("format");
    expect(storeSlugProblem("taller_luna")).toBe("format");
  });

  it("reservados", () => {
    for (const s of ["www", "app", "admin", "api", "mail", "ecommy", "platform", "static", "cdn", "demo"]) {
      expect(RESERVED_STORE_SLUGS).toContain(s);
      expect(storeSlugProblem(s)).toBe(s.length < 3 ? "short" : "reserved");
    }
    expect(storeSlugProblem("login")).toBe("reserved");
  });

  it("toStoreSlug normaliza texto libre", () => {
    expect(toStoreSlug("Taller Luna")).toBe("taller-luna");
    expect(toStoreSlug("  Cerámica & Diseño ñandú ")).toBe("ceramica-y-diseno-nandu");
    expect(toStoreSlug("---")).toBe("");
    expect(toStoreSlug("a".repeat(60)).length).toBe(40);
  });
});
