import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { geometryIsPlausible } from "./geometry";
import { analyzeMesh, detectFormat, ModelParseError, parse3mf, parseModel, parseStl, scaleGeometry, suggestUnit, unitFactor } from "./mesh";

type V3 = [number, number, number];

/** Cubo de lado `s` en [o, o+s]³: 12 triángulos con normales hacia afuera. */
function cubeTriangles(s: number, o: V3 = [0, 0, 0]): V3[][] {
  const p = (x: number, y: number, z: number): V3 => [o[0] + x * s, o[1] + y * s, o[2] + z * s];
  const quads: V3[][] = [
    [p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)],
    [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)],
    [p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)],
    [p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)],
    [p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)],
    [p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)],
  ];
  return quads.flatMap((q) => [
    [q[0], q[1], q[2]],
    [q[0], q[2], q[3]],
  ]);
}

function binaryStl(tris: V3[][], header = "binario de prueba"): ArrayBuffer {
  const buf = new ArrayBuffer(84 + 50 * tris.length);
  const view = new DataView(buf);
  new Uint8Array(buf).set(strToU8(header).subarray(0, 80));
  view.setUint32(80, tris.length, true);
  tris.forEach((t, i) => {
    const o = 84 + i * 50 + 12;
    t.forEach((v, j) => v.forEach((c, k) => view.setFloat32(o + j * 12 + k * 4, c, true)));
  });
  return buf;
}

function asciiStl(tris: V3[][]): ArrayBuffer {
  const body = tris
    .map((t) => ["  facet normal 0 0 0", "    outer loop", ...t.map((v) => `      vertex ${v.join(" ")}`), "    endloop", "  endfacet"].join("\n"))
    .join("\n");
  return strToU8(`solid cubo\n${body}\nendsolid cubo\n`).buffer as ArrayBuffer;
}

function toBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

describe("parseStl + analyzeMesh", () => {
  it("cubo de 20 mm en STL binario: V = 8000, A = 2400, estanco", () => {
    const mesh = parseStl(binaryStl(cubeTriangles(20)));
    expect(mesh.triangles).toBe(12);
    expect(mesh.positions.length).toBe(108);
    const g = analyzeMesh(mesh);
    expect(g).toEqual({ volume_mm3: 8000, area_mm2: 2400, bbox: [20, 20, 20], triangles: 12, manifold: true });
    expect(geometryIsPlausible(g)).toBe(true);
  });

  it("binario cuyo encabezado arranca con 'solid' se lee como binario", () => {
    const g = analyzeMesh(parseStl(binaryStl(cubeTriangles(20), "solid pero binario")));
    expect(g.volume_mm3).toBe(8000);
  });

  it("cubo de 20 mm en STL ASCII, lejos del origen", () => {
    const g = analyzeMesh(parseStl(asciiStl(cubeTriangles(20, [150, -80, 30]))));
    expect(g).toEqual({ volume_mm3: 8000, area_mm2: 2400, bbox: [20, 20, 20], triangles: 12, manifold: true });
  });

  it("el volumen no depende del sentido de los triángulos (valor absoluto)", () => {
    const flipped = cubeTriangles(20).map((t) => [t[0], t[2], t[1]]);
    expect(analyzeMesh(parseStl(binaryStl(flipped))).volume_mm3).toBe(8000);
  });

  it("malla abierta (cubo sin una cara) → manifold false", () => {
    const open = cubeTriangles(20).slice(2);
    const g = analyzeMesh(parseStl(binaryStl(open)));
    expect(g.manifold).toBe(false);
    expect(g.area_mm2).toBe(2000);
  });

  it("suelda vértices a 1e-4 mm", () => {
    const tris = cubeTriangles(20);
    tris[0][0] = [tris[0][0][0] + 0.00001, tris[0][0][1], tris[0][0][2]];
    expect(analyzeMesh(parseStl(binaryStl(tris))).manifold).toBe(true);
    tris[0][0] = [tris[0][0][0] + 0.01, tris[0][0][1], tris[0][0][2]];
    expect(analyzeMesh(parseStl(binaryStl(tris))).manifold).toBe(false);
  });

  it("arista compartida por 4 triángulos (dos cubos pegados por una arista) no es manifold", () => {
    const tris = [...cubeTriangles(10), ...cubeTriangles(10, [10, 10, 0])];
    const g = analyzeMesh(parseStl(binaryStl(tris)));
    expect(g.volume_mm3).toBe(2000);
    expect(g.manifold).toBe(false);
  });

  it("toroide cerrado de 20 000 triángulos es estanco", () => {
    const tris: V3[][] = [];
    const N = 200;
    const M = 50;
    const pt = (i: number, j: number): V3 => {
      const u = ((i % N) / N) * Math.PI * 2;
      const v = ((j % M) / M) * Math.PI * 2;
      return [(40 + 10 * Math.cos(v)) * Math.cos(u), (40 + 10 * Math.cos(v)) * Math.sin(u), 10 * Math.sin(v)];
    };
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        tris.push([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1)], [pt(i, j), pt(i + 1, j + 1), pt(i, j + 1)]);
      }
    }
    const g = analyzeMesh(parseStl(binaryStl(tris)));
    expect(g.triangles).toBe(20_000);
    expect(g.manifold).toBe(true);
    // 2π²·R·r² ≈ 78 957 mm³ (la malla facetada queda un poco por debajo).
    expect(g.volume_mm3).toBeGreaterThan(78_000);
    expect(g.volume_mm3).toBeLessThan(79_000);
  });

  it("errores en castellano", () => {
    expect(() => parseStl(new ArrayBuffer(0))).toThrow("El archivo está vacío.");
    expect(() => parseStl(strToU8("hola, esto no es un modelo").buffer as ArrayBuffer)).toThrow("El archivo no parece un STL válido.");
    expect(() => parseStl(strToU8("solid x\n vertex 1 2 3\n vertex 1 2\nendsolid").buffer as ArrayBuffer)).toThrow(ModelParseError);
    expect(() => parseStl(strToU8("solid x\n vertex 1 2 nan\nendsolid").buffer as ArrayBuffer)).toThrow("El STL tiene coordenadas inválidas.");
  });
});

/* ------------------------------------------------------------------ 3MF */

const CUBE_VERTS: V3[] = [
  [0, 0, 0],
  [2, 0, 0],
  [2, 2, 0],
  [0, 2, 0],
  [0, 0, 2],
  [2, 0, 2],
  [2, 2, 2],
  [0, 2, 2],
];
const CUBE_TRIS = [
  [0, 3, 2], [0, 2, 1], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
  [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5],
];

function meshXml(): string {
  const v = CUBE_VERTS.map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join("");
  const t = CUBE_TRIS.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join("");
  return `<mesh><vertices>${v}</vertices><triangles>${t}</triangles></mesh>`;
}

function model(unit: string, resources: string, build: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="${unit}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
  <resources>${resources}</resources>
  <build>${build}</build>
</model>`;
}

const RELS = (target: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="${target}" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

function zip3mf(files: Record<string, string>): ArrayBuffer {
  const entries: Record<string, Uint8Array> = { "[Content_Types].xml": strToU8("<Types/>") };
  for (const [name, text] of Object.entries(files)) entries[name] = strToU8(text);
  return toBuffer(zipSync(entries));
}

describe("parse3mf", () => {
  it("unit=centimeter + transform con escala ×2 y traslación: cubo de 40 mm", () => {
    const xml = model("centimeter", `<object id="1" type="model">${meshXml()}</object>`, `<item objectid="1" transform="2 0 0 0 2 0 0 0 2 10 5 0"/>`);
    const mesh = parse3mf(zip3mf({ "_rels/.rels": RELS("/3D/3dmodel.model"), "3D/3dmodel.model": xml }));
    expect(mesh.triangles).toBe(12);
    const g = analyzeMesh(mesh);
    expect(g).toEqual({ volume_mm3: 64000, area_mm2: 9600, bbox: [40, 40, 40], triangles: 12, manifold: true });
    // La traslación (10 cm, 5 cm) se aplica en mm.
    expect(Math.min(...Array.from(mesh.positions).filter((_, i) => i % 3 === 0))).toBe(100);
    expect(Math.min(...Array.from(mesh.positions).filter((_, i) => i % 3 === 1))).toBe(50);
  });

  it("componentes, dos items y un espejo: el volumen suma, no se cancela", () => {
    const resources =
      `<object id="1" type="model">${meshXml()}</object>` +
      `<object id="2" type="model"><components><component objectid="1" transform="1 0 0 0 1 0 0 0 1 5 0 0"/></components></object>`;
    const build = `<item objectid="2"/><item objectid="1" transform="-1 0 0 0 1 0 0 0 1 -10 0 0"/>`;
    const g = analyzeMesh(parse3mf(zip3mf({ "3D/3dmodel.model": model("millimeter", resources, build) })));
    expect(g.triangles).toBe(24);
    expect(g.volume_mm3).toBe(16);
    expect(g.manifold).toBe(true);
    // x: espejo en [-12, -10] y el componente en [5, 7].
    expect(g.bbox).toEqual([19, 2, 2]);
  });

  it("modelo fuera del path estándar (lo encuentra por _rels/.rels) y objetos en otro .model (Bambu)", () => {
    const sub = model("millimeter", `<object id="7" type="model">${meshXml()}</object>`, "");
    const root = model(
      "inch",
      `<object id="1" type="model"><components><component p:path="/3D/Objects/pieza.model" objectid="7"/></components></object>`,
      `<item objectid="1"/>`,
    );
    const buf = zip3mf({ "_rels/.rels": RELS("/3D/principal.model"), "3D/principal.model": root, "3D/Objects/pieza.model": sub });
    const g = analyzeMesh(parse3mf(buf));
    expect(g.bbox).toEqual([50.8, 50.8, 50.8]);
    expect(g.volume_mm3).toBeCloseTo(50.8 ** 3, 0);
  });

  it("items no imprimibles no cuentan", () => {
    const xml = model("millimeter", `<object id="1" type="model">${meshXml()}</object>`, `<item objectid="1"/><item objectid="1" printable="0" transform="1 0 0 0 1 0 0 0 1 50 0 0"/>`);
    expect(parse3mf(zip3mf({ "3D/3dmodel.model": xml })).triangles).toBe(12);
  });

  it("errores en castellano", () => {
    expect(() => parse3mf(strToU8("no es un zip").buffer as ArrayBuffer)).toThrow("El archivo no parece un 3MF válido.");
    expect(() => parse3mf(zip3mf({ "3D/3dmodel.model": model("millimeter", "", "") }))).toThrow("El 3MF no tiene ninguna pieza.");
    expect(() => parse3mf(zip3mf({ "Metadata/thumb.txt": "x" }))).toThrow("El 3MF no tiene ningún modelo 3D adentro.");
    expect(() =>
      parse3mf(zip3mf({ "3D/3dmodel.model": model("parsec", `<object id="1">${meshXml()}</object>`, `<item objectid="1"/>`) })),
    ).toThrow("unidad");
    expect(() =>
      parse3mf(zip3mf({ "3D/3dmodel.model": model("millimeter", `<object id="1">${meshXml()}</object>`, `<item objectid="9"/>`) })),
    ).toThrow("El 3MF referencia una pieza que no existe.");
    const broken = meshXml().replace('v3="1"', 'v3="99"');
    expect(() =>
      parse3mf(zip3mf({ "3D/3dmodel.model": model("millimeter", `<object id="1">${broken}</object>`, `<item objectid="1"/>`) })),
    ).toThrow("vértices que no existen");
  });
});

describe("parseModel y unidades", () => {
  it("elige el parser por extensión", () => {
    expect(detectFormat("Pieza Final.STL")).toBe("stl");
    expect(detectFormat("placa.3mf")).toBe("3mf");
    expect(detectFormat("modelo.obj")).toBeNull();
    expect(parseModel(binaryStl(cubeTriangles(20)), "cubo.stl").triangles).toBe(12);
    const xml = model("millimeter", `<object id="1">${meshXml()}</object>`, `<item objectid="1"/>`);
    expect(parseModel(zip3mf({ "3D/3dmodel.model": xml }), "cubo.3mf").triangles).toBe(12);
    // Un 3MF renombrado a .stl también se lee.
    expect(parseModel(zip3mf({ "3D/3dmodel.model": xml }), "cubo.stl").triangles).toBe(12);
    expect(() => parseModel(new ArrayBuffer(10), "modelo.obj")).toThrow("Sólo aceptamos archivos STL o 3MF.");
    expect(() => parseModel(new ArrayBuffer(0), "vacio.stl")).toThrow("El archivo está vacío.");
  });

  it("scaleGeometry, unitFactor y suggestUnit", () => {
    const g = analyzeMesh(parseStl(binaryStl(cubeTriangles(2))));
    expect(suggestUnit(g.bbox)).toBe("cm");
    const mm = scaleGeometry(g, unitFactor("cm"));
    expect(mm).toEqual({ volume_mm3: 8000, area_mm2: 2400, bbox: [20, 20, 20], triangles: 12, manifold: true });
    expect(suggestUnit(mm.bbox)).toBeNull();
    expect(unitFactor("mm")).toBe(1);
    expect(unitFactor("in")).toBe(25.4);
    expect(scaleGeometry(mm, 0.5).volume_mm3).toBe(1000);
  });
});
