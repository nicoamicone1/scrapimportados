import { describe, expect, it } from "vitest";

import { CABA_POLYGON } from "./examples";
import {
  countVertices,
  geometryAreaKm2,
  normalizeGeometry,
  parseGeoJsonText,
  pointInGeometry,
  type ZoneGeometry,
} from "./geometry";
import {
  PROVINCES,
  normalizePostalCode,
  normalizeProvince,
  parsePostalPrefixes,
  postalCodeMatchesPrefix,
  provinceFromPostalCode,
  POSTAL_PREFIX_RE,
} from "./provinces";
import { amountForFreeShipping, computeShippingCost, evaluateZones, resolveZone, type ResolvableZone } from "./resolve";

// Puntos reales
const PALERMO = { lat: -34.5889, lng: -58.4306 }; // Plaza Italia aprox.
const OBELISCO = { lat: -34.6037, lng: -58.3816 };
const LINIERS = { lat: -34.639, lng: -58.522 };
const LA_PLATA = { lat: -34.9214, lng: -57.9544 };
const AVELLANEDA = { lat: -34.6624, lng: -58.3653 };
const SAN_ISIDRO = { lat: -34.4708, lng: -58.5286 };
const CORDOBA = { lat: -31.4201, lng: -64.1888 };

describe("provincias", () => {
  it("tiene las 24 jurisdicciones con código ISO único", () => {
    expect(PROVINCES).toHaveLength(24);
    expect(new Set(PROVINCES.map((p) => p.code)).size).toBe(24);
    expect(PROVINCES.every((p) => /^AR-[A-Z]$/.test(p.code))).toBe(true);
  });

  it.each([
    ["CABA", "AR-C"],
    ["C.A.B.A.", "AR-C"],
    ["Capital Federal", "AR-C"],
    ["Ciudad Autónoma de Buenos Aires", "AR-C"],
    ["ciudad autonoma de buenos aires", "AR-C"],
    ["Cdad. Aut. de Bs. As.", "AR-C"],
    ["Ciudad de Buenos Aires", "AR-C"],
    ["Bs. As.", "AR-B"],
    ["Bs As", "AR-B"],
    ["Buenos Aires", "AR-B"],
    ["Provincia de Buenos Aires", "AR-B"],
    ["Pcia. de Bs. As.", "AR-B"],
    ["PBA", "AR-B"],
    ["Córdoba", "AR-X"],
    ["cordoba", "AR-X"],
    ["Entre Rios", "AR-E"],
    ["Neuquen", "AR-Q"],
    ["Río Negro", "AR-R"],
    ["Sgo. del Estero", "AR-G"],
    ["Tierra del Fuego, Antártida e Islas del Atlántico Sur", "AR-V"],
    ["Tucumán", "AR-T"],
    ["AR-S", "AR-S"],
    ["ar-m", "AR-M"],
    ["S", "AR-S"],
    ["Mendoza Province", "AR-M"],
  ])("normalizeProvince(%s) → %s", (input, code) => {
    expect(normalizeProvince(input)).toBe(code);
  });

  it("devuelve null para cosas que no son provincias", () => {
    expect(normalizeProvince("")).toBeNull();
    expect(normalizeProvince(null)).toBeNull();
    expect(normalizeProvince("Montevideo")).toBeNull();
    expect(normalizeProvince("AR-I")).toBeNull();
  });
});

describe("códigos postales", () => {
  it("normaliza CP y CPA", () => {
    expect(normalizePostalCode("B1900ABC")).toEqual({ digits: "1900", cpa: "B1900ABC", letter: "B" });
    expect(normalizePostalCode("c1425 bhc")).toEqual({ digits: "1425", cpa: "C1425BHC", letter: "C" });
    expect(normalizePostalCode(" 1 900 ")).toEqual({ digits: "1900", cpa: null, letter: null });
    expect(normalizePostalCode("")).toEqual({ digits: null, cpa: null, letter: null });
    expect(provinceFromPostalCode("X5000ABC")).toBe("AR-X");
  });

  it("parsea prefijos separados por coma o salto de línea", () => {
    expect(parsePostalPrefixes("1900, 19\n b1878 ,1900")).toEqual(["1900", "19", "B1878"]);
  });

  it("valida el formato de prefijo", () => {
    for (const ok of ["1", "19", "1900", "B19", "B1900", "B1900ABC"]) expect(POSTAL_PREFIX_RE.test(ok)).toBe(true);
    for (const bad of ["19000", "AB12", "B1900AB", "x"]) expect(POSTAL_PREFIX_RE.test(bad)).toBe(false);
  });

  it("matchea prefijos numéricos contra los dígitos del CPA", () => {
    const laPlata = normalizePostalCode("B1900ABC");
    expect(postalCodeMatchesPrefix(laPlata, "19")).toBe(true);
    expect(postalCodeMatchesPrefix(laPlata, "1900")).toBe(true);
    expect(postalCodeMatchesPrefix(laPlata, "18")).toBe(false);
    expect(postalCodeMatchesPrefix(laPlata, "B19")).toBe(true);
    expect(postalCodeMatchesPrefix(laPlata, "C19")).toBe(false);
    expect(postalCodeMatchesPrefix(laPlata, "B1900ABC")).toBe(true);
    expect(postalCodeMatchesPrefix(laPlata, "B1900ABD")).toBe(false);
    // Prefijo con letra y CP sin letra: usa la provincia.
    expect(postalCodeMatchesPrefix(normalizePostalCode("1900"), "B19", "AR-B")).toBe(true);
    expect(postalCodeMatchesPrefix(normalizePostalCode("1900"), "B19", null)).toBe(false);
  });
});

describe("geometría", () => {
  it("el polígono de CABA contiene Palermo y el Obelisco, pero no La Plata ni Avellaneda", () => {
    expect(pointInGeometry(PALERMO, CABA_POLYGON)).toBe(true);
    expect(pointInGeometry(OBELISCO, CABA_POLYGON)).toBe(true);
    expect(pointInGeometry(LINIERS, CABA_POLYGON)).toBe(true);
    expect(pointInGeometry(LA_PLATA, CABA_POLYGON)).toBe(false);
    expect(pointInGeometry(AVELLANEDA, CABA_POLYGON)).toBe(false);
    expect(pointInGeometry(SAN_ISIDRO, CABA_POLYGON)).toBe(false);
  });

  it("el área de CABA es realista (~200 km²)", () => {
    const km2 = geometryAreaKm2(CABA_POLYGON);
    expect(km2).toBeGreaterThan(180);
    expect(km2).toBeLessThan(230);
    expect(countVertices(CABA_POLYGON)).toBe(21);
  });

  it("cierra anillos abiertos y redondea a 6 decimales", () => {
    const res = normalizeGeometry({
      type: "Polygon",
      coordinates: [
        [
          [-58.1234567, -34.1],
          [-58.2, -34.1],
          [-58.2, -34.2],
        ],
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.geometry.type).toBe("Polygon");
    const ring = (res.geometry as Extract<ZoneGeometry, { type: "Polygon" }>).coordinates[0];
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual(ring[3]);
    expect(ring[0][0]).toBe(-58.123457);
  });

  it("rechaza anillos con menos de 3 vértices distintos y coordenadas fuera de rango", () => {
    expect(normalizeGeometry({ type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 0]]] }).ok).toBe(false);
    expect(normalizeGeometry({ type: "Polygon", coordinates: [[[0, 0], [0, 0], [1, 1], [1, 1]]] }).ok).toBe(false);
    const out = normalizeGeometry({ type: "Polygon", coordinates: [[[0, 95], [1, 1], [2, 2]]] });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/latitud/);
    expect(normalizeGeometry({ type: "Point", coordinates: [0, 0] }).ok).toBe(false);
  });

  it("acepta Feature y FeatureCollection y junta varios polígonos en un MultiPolygon", () => {
    const square = (x: number) => [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]];
    const res = normalizeGeometry({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: square(0) } },
        { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: [square(5), square(10)] } },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.geometry.type).toBe("MultiPolygon");
      expect(res.geometry.coordinates).toHaveLength(3);
      expect(pointInGeometry({ lat: 0.5, lng: 10.5 }, res.geometry)).toBe(true);
      expect(pointInGeometry({ lat: 0.5, lng: 3 }, res.geometry)).toBe(false);
    }
  });

  it("parseGeoJsonText informa JSON inválido", () => {
    const res = parseGeoJsonText("{nope");
    expect(res.ok).toBe(false);
  });
});

function zone(partial: Partial<ResolvableZone> & Pick<ResolvableZone, "id" | "type" | "position">): ResolvableZone {
  return {
    name: partial.id,
    geometry: null,
    provinces: [],
    postalPrefixes: [],
    cost: 1000,
    freeOver: null,
    etaText: null,
    ...partial,
  };
}

const ZONES: ResolvableZone[] = [
  zone({ id: "caba", type: "polygon", position: 0, geometry: CABA_POLYGON, cost: 3500, freeOver: 60000, etaText: "24 a 48 hs" }),
  zone({ id: "laplata", type: "postal_prefixes", position: 1, postalPrefixes: ["1900", "B19"], cost: 5000 }),
  zone({ id: "gba", type: "provinces", position: 2, provinces: ["AR-B"], cost: 5500, freeOver: 90000 }),
  zone({ id: "pais", type: "everywhere", position: 3, cost: 9500 }),
];

describe("resolveZone", () => {
  it("un punto en Palermo cae en CABA (polígono)", () => {
    const r = resolveZone({ zones: ZONES, address: { province: "CABA", postal_code: "C1425BHC" }, point: PALERMO });
    expect(r?.zone.id).toBe("caba");
    expect(r?.matchedBy).toBe("polygon");
    expect(r?.cost).toBe(3500);
    expect(r?.freeOver).toBe(60000);
    expect(r?.eta).toBe("24 a 48 hs");
  });

  it("La Plata no está en el polígono: gana el prefijo postal (position 1)", () => {
    const r = resolveZone({ zones: ZONES, address: { province: "Buenos Aires", postal_code: "B1900ABC" }, point: LA_PLATA });
    expect(r?.zone.id).toBe("laplata");
  });

  it("Avellaneda cae en la zona de provincia", () => {
    const r = resolveZone({ zones: ZONES, address: { province: "Bs. As.", postal_code: "1870" }, point: AVELLANEDA });
    expect(r?.zone.id).toBe("gba");
  });

  it("Córdoba cae en 'todo el país'", () => {
    const r = resolveZone({ zones: ZONES, address: { province: "Córdoba", postal_code: "5000" }, point: CORDOBA });
    expect(r?.zone.id).toBe("pais");
  });

  it("sin punto, las zonas de polígono no matchean", () => {
    const r = resolveZone({ zones: ZONES, address: { province: "CABA" } });
    expect(r?.zone.id).toBe("pais");
  });

  it("la provincia se deduce de la letra del CPA si no viene", () => {
    const r = resolveZone({ zones: ZONES, address: { postal_code: "B1878ABC" } });
    expect(r?.zone.id).toBe("gba");
  });

  it("respeta el orden por position, no el del array", () => {
    const reordered = [
      { ...ZONES[3], position: 0 },
      { ...ZONES[0], position: 1 },
    ];
    const r = resolveZone({ zones: reordered, address: {}, point: PALERMO });
    expect(r?.zone.id).toBe("pais");
  });

  it("ignora zonas inactivas y devuelve null si nada matchea", () => {
    const onlyCaba = [{ ...ZONES[0] }, { ...ZONES[3], isActive: false }];
    expect(resolveZone({ zones: onlyCaba, address: {}, point: LA_PLATA })).toBeNull();
  });

  it("aplica envío gratis con subtotal", () => {
    expect(resolveZone({ zones: ZONES, address: {}, point: PALERMO, subtotal: 59999 })?.cost).toBe(3500);
    expect(resolveZone({ zones: ZONES, address: {}, point: PALERMO, subtotal: 60000 })?.cost).toBe(0);
  });

  it("evaluateZones marca todas las que incluyen y la ganadora", () => {
    const ev = evaluateZones({ zones: ZONES, address: { province: "CABA" }, point: PALERMO });
    expect(ev.filter((e) => e.includes).map((e) => e.zone.id)).toEqual(["caba", "pais"]);
    expect(ev.find((e) => e.winner)?.zone.id).toBe("caba");
  });
});

describe("computeShippingCost", () => {
  it("devuelve 0 desde free_over y el costo por debajo", () => {
    expect(computeShippingCost({ cost: 3500, freeOver: 60000 }, 10000)).toBe(3500);
    expect(computeShippingCost({ cost: 3500, freeOver: 60000 }, 60000)).toBe(0);
    expect(computeShippingCost({ cost: 3500, freeOver: null }, 1e9)).toBe(3500);
    expect(amountForFreeShipping({ freeOver: 60000 }, 45000)).toBe(15000);
    expect(amountForFreeShipping({ freeOver: null }, 45000)).toBeNull();
  });
});
