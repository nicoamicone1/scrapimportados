/*
 * Taller 3D — lectura de STL/3MF y análisis de la malla (volumen, área, caja
 * y estanqueidad). Puro y sin DOM: corre en el worker del navegador y en node.
 * Todo con typed arrays: tiene que aguantar 1–2 M de triángulos.
 */
import { unzipSync } from "fflate";

import { roundTo } from "./round";
import type { Geometry, LengthUnit, Mesh, ModelFormat } from "./types";

/** Error de lectura con un mensaje que se le puede mostrar al cliente. */
export class ModelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelParseError";
  }
}

function fail(message: string): never {
  throw new ModelParseError(message);
}

/* ---------------------------------------------------------------- listas */

/** Lista creciente sobre un typed array (sin objetos por vértice). */
class Float32List {
  data: Float32Array;
  length = 0;
  constructor(capacity: number) {
    this.data = new Float32Array(Math.max(capacity, 64));
  }
  push3(a: number, b: number, c: number) {
    if (this.length + 3 > this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = a;
    this.data[this.length++] = b;
    this.data[this.length++] = c;
  }
  /** Copia exacta (así el buffer se puede transferir entero). */
  finish(): Float32Array {
    return this.data.length === this.length ? this.data : this.data.slice(0, this.length);
  }
}

class Float64List {
  data: Float64Array;
  length = 0;
  constructor(capacity: number) {
    this.data = new Float64Array(Math.max(capacity, 64));
  }
  push3(a: number, b: number, c: number) {
    if (this.length + 3 > this.data.length) {
      const next = new Float64Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = a;
    this.data[this.length++] = b;
    this.data[this.length++] = c;
  }
}

class Uint32List {
  data: Uint32Array;
  length = 0;
  constructor(capacity: number) {
    this.data = new Uint32Array(Math.max(capacity, 64));
  }
  push3(a: number, b: number, c: number) {
    if (this.length + 3 > this.data.length) {
      const next = new Uint32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = a;
    this.data[this.length++] = b;
    this.data[this.length++] = c;
  }
}

/* ------------------------------------------------------------------ STL */

const STL_INVALID = "El archivo no parece un STL válido.";

/** ¿Arranca con "solid" (ignorando espacios)? */
function startsWithSolid(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length && i < 256 && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0xef || bytes[i] === 0xbb || bytes[i] === 0xbf)) i++;
  const word = String.fromCharCode(...bytes.subarray(i, i + 5)).toLowerCase();
  return word === "solid";
}

function parseStlBinary(buf: ArrayBuffer, n: number): Mesh {
  const view = new DataView(buf);
  const positions = new Float32Array(n * 9);
  let k = 0;
  // 50 bytes por triángulo: normal (12) + 3 vértices (36) + atributo (2).
  for (let t = 0, o = 96; t < n; t++, o += 50) {
    for (let j = 0; j < 36; j += 4) {
      const v = view.getFloat32(o + j, true);
      if (v - v !== 0) fail("El STL tiene coordenadas inválidas.");
      positions[k++] = v;
    }
  }
  return { positions, triangles: n };
}

/** null si no encontró ningún vértice (para probar como binario). */
function parseStlAscii(bytes: Uint8Array): Mesh | null {
  const text = new TextDecoder().decode(bytes);
  const out = new Float32List(Math.min(1 << 22, Math.ceil(bytes.length / 40)));
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    const z = Number(m[3]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) fail("El STL tiene coordenadas inválidas.");
    out.push3(x, y, z);
  }
  if (out.length === 0) return null;
  if (out.length % 9 !== 0) fail("El STL está incompleto o dañado.");
  return { positions: out.finish(), triangles: out.length / 9 };
}

/**
 * STL binario o ASCII. Es ASCII si empieza con "solid" y el tamaño no cuadra
 * con el binario (84 + 50·n); muchos binarios también arrancan con "solid".
 */
export function parseStl(buf: ArrayBuffer): Mesh {
  const size = buf.byteLength;
  if (size === 0) fail("El archivo está vacío.");
  const bytes = new Uint8Array(buf);
  const n = size >= 84 ? new DataView(buf).getUint32(80, true) : -1;
  const binaryFits = n > 0 && 84 + 50 * n === size;
  if (startsWithSolid(bytes) && !binaryFits) {
    const ascii = parseStlAscii(bytes);
    if (ascii) return ascii;
  }
  // Algunos exportadores dejan bytes de más al final: se toleran.
  if (n <= 0 || size < 84 + 50 * n) fail(STL_INVALID);
  return parseStlBinary(buf, n);
}

/* ------------------------------------------------------------------ 3MF */

/** Factor a mm de cada `<model unit>` del estándar 3MF. */
const UNIT_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

/** Matriz 3MF de 3x4 en orden de fila: m00 m01 m02 m10 … m30 m31 m32. */
type Mat = Float64Array;

interface MeshDef {
  verts: Float64Array;
  tris: Uint32Array;
  triCount: number;
}

interface RefDef {
  objectId: string;
  path: string | null;
  matrix: Mat | null;
}

interface ObjectDef {
  type: string;
  mesh: MeshDef | null;
  components: RefDef[];
}

interface ModelDoc {
  unitMm: number;
  objects: Map<string, ObjectDef>;
  /** null = el archivo no trae `<build>`. */
  items: RefDef[] | null;
}

interface Instance {
  mesh: MeshDef;
  matrix: Mat | null;
}

/** Prefijo de namespace opcional (`<m:vertex>`). */
const NS = "(?:[A-Za-z_][\\w.-]*:)?";

function openTag(name: string): RegExp {
  return new RegExp(`<${NS}${name}\\b([^>]*)>`, "g");
}

function closeTag(name: string): RegExp {
  return new RegExp(`</${NS}${name}\\s*>`, "g");
}

const attrRes = new Map<string, RegExp>();

/** Valor de un atributo (`name` puede ser un fragmento de regex). */
function attr(attrs: string, name: string): string | null {
  let re = attrRes.get(name);
  if (!re) {
    re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
    attrRes.set(name, re);
  }
  const m = re.exec(attrs);
  return m ? (m[1] ?? m[2] ?? "") : null;
}

const PATH_ATTR = "[\\w.-]+:path";

function normPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function parseTransform(value: string | null): Mat | null {
  const s = value?.trim();
  if (!s) return null;
  const parts = s.split(/\s+/).map(Number);
  if (parts.length !== 12 || parts.some((v) => !Number.isFinite(v))) fail("El 3MF tiene una transformación inválida.");
  return Float64Array.from(parts);
}

/** Aplica `a` y después `b` (vector fila: p · A · B). */
function compose(a: Mat | null, b: Mat | null): Mat | null {
  if (!a) return b;
  if (!b) return a;
  const c = new Float64Array(12);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      c[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j] + (i === 3 ? b[9 + j] : 0);
    }
  }
  return c;
}

function determinant(m: Mat): number {
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
}

function parseRef(attrs: string): RefDef | null {
  const objectId = attr(attrs, "objectid");
  if (objectId === null) return null;
  const path = attr(attrs, PATH_ATTR);
  return { objectId, path: path ? normPath(path) : null, matrix: parseTransform(attr(attrs, "transform")) };
}

function parseMeshBody(xml: string, start: number, end: number): MeshDef {
  const verts = new Float64List(1024);
  const vRe = openTag("vertex");
  vRe.lastIndex = start;
  for (let m = vRe.exec(xml); m && m.index < end; m = vRe.exec(xml)) {
    const x = Number(attr(m[1], "x"));
    const y = Number(attr(m[1], "y"));
    const z = Number(attr(m[1], "z"));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) fail("El 3MF tiene coordenadas inválidas.");
    verts.push3(x, y, z);
  }
  const vertexCount = verts.length / 3;
  const tris = new Uint32List(1024);
  const tRe = openTag("triangle");
  tRe.lastIndex = start;
  for (let m = tRe.exec(xml); m && m.index < end; m = tRe.exec(xml)) {
    const a = Number(attr(m[1], "v1"));
    const b = Number(attr(m[1], "v2"));
    const c = Number(attr(m[1], "v3"));
    const ok = (v: number) => Number.isInteger(v) && v >= 0 && v < vertexCount;
    if (!ok(a) || !ok(b) || !ok(c)) fail("El 3MF tiene triángulos que apuntan a vértices que no existen.");
    tris.push3(a, b, c);
  }
  return { verts: verts.data, tris: tris.data, triCount: tris.length / 3 };
}

function parseObjectBody(xml: string, start: number, end: number, type: string): ObjectDef {
  const meshRe = openTag("mesh");
  meshRe.lastIndex = start;
  const meshTag = meshRe.exec(xml);
  const mesh = meshTag && meshTag.index < end ? parseMeshBody(xml, meshRe.lastIndex, end) : null;
  const components: RefDef[] = [];
  const cRe = openTag("component");
  cRe.lastIndex = start;
  for (let m = cRe.exec(xml); m && m.index < end; m = cRe.exec(xml)) {
    const ref = parseRef(m[1]);
    if (ref) components.push(ref);
  }
  return { type, mesh, components };
}

function parseModelXml(xml: string): ModelDoc {
  const modelTag = new RegExp(`<${NS}model\\b([^>]*)>`).exec(xml);
  if (!modelTag) fail("El 3MF no tiene un modelo 3D válido.");
  const unit = (attr(modelTag[1], "unit") ?? "millimeter").trim().toLowerCase() || "millimeter";
  const unitMm = UNIT_MM[unit];
  if (!unitMm) fail("El 3MF usa una unidad de medida que no conocemos.");

  const objects = new Map<string, ObjectDef>();
  const oRe = openTag("object");
  const endRe = closeTag("object");
  for (let m = oRe.exec(xml); m; m = oRe.exec(xml)) {
    const attrs = m[1];
    const id = attr(attrs, "id");
    const type = (attr(attrs, "type") ?? "model").toLowerCase();
    if (attrs.trimEnd().endsWith("/")) {
      if (id !== null) objects.set(id, { type, mesh: null, components: [] });
      continue;
    }
    const bodyStart = oRe.lastIndex;
    endRe.lastIndex = bodyStart;
    const close = endRe.exec(xml);
    const bodyEnd = close ? close.index : xml.length;
    if (id !== null) objects.set(id, parseObjectBody(xml, bodyStart, bodyEnd, type));
    oRe.lastIndex = close ? endRe.lastIndex : xml.length;
  }

  let items: RefDef[] | null = null;
  const bRe = openTag("build");
  const build = bRe.exec(xml);
  if (build && !build[1].trimEnd().endsWith("/")) {
    items = [];
    const bEnd = closeTag("build");
    bEnd.lastIndex = bRe.lastIndex;
    const close = bEnd.exec(xml);
    const end = close ? close.index : xml.length;
    const iRe = openTag("item");
    iRe.lastIndex = bRe.lastIndex;
    for (let m = iRe.exec(xml); m && m.index < end; m = iRe.exec(xml)) {
      if (attr(m[1], "printable") === "0") continue;
      const ref = parseRef(m[1]);
      if (ref) items.push(ref);
    }
  } else if (build) {
    items = [];
  }
  return { unitMm, objects, items };
}

/** Ruta del modelo principal: la estándar o la que diga `_rels/.rels`. */
function findRootModel(files: Map<string, Uint8Array>, decode: (b: Uint8Array) => string): string {
  const standard = "3d/3dmodel.model";
  if (files.has(standard)) return standard;
  const rels = files.get("_rels/.rels");
  if (rels) {
    const relRe = /<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*)>/g;
    const xml = decode(rels);
    for (let m = relRe.exec(xml); m; m = relRe.exec(xml)) {
      const type = attr(m[1], "Type") ?? "";
      const target = attr(m[1], "Target");
      if (target && /\/3dmodel$/i.test(type) && files.has(normPath(target))) return normPath(target);
    }
  }
  for (const name of files.keys()) if (name.endsWith(".model")) return name;
  return fail("El 3MF no tiene ningún modelo 3D adentro.");
}

/**
 * 3MF (zip): modelo principal, objetos con `<mesh>` o `<components>` (también
 * en otros .model, como los de Bambu Studio) y `<build><item transform>`.
 * Aplica las transformaciones y pasa `<model unit>` a mm.
 */
export function parse3mf(buf: ArrayBuffer): Mesh {
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(new Uint8Array(buf), {
      filter: (f) => {
        const name = f.name.toLowerCase();
        return name.endsWith(".model") || name.endsWith(".rels");
      },
    });
  } catch {
    return fail("El archivo no parece un 3MF válido.");
  }
  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(raw)) files.set(normPath(name), data);

  const decoder = new TextDecoder();
  const decode = (b: Uint8Array) => decoder.decode(b);
  const rootPath = findRootModel(files, decode);

  const docs = new Map<string, ModelDoc>();
  const getDoc = (path: string): ModelDoc => {
    let doc = docs.get(path);
    if (!doc) {
      const bytes = files.get(path);
      if (!bytes) return fail("El 3MF referencia un archivo que no está adentro.");
      doc = parseModelXml(decode(bytes));
      docs.set(path, doc);
    }
    return doc;
  };
  const root = getDoc(rootPath);

  const instances: Instance[] = [];
  const stack = new Set<string>();
  const expand = (path: string, objectId: string, matrix: Mat | null, depth: number) => {
    const key = `${path}#${objectId}`;
    if (depth > 32 || stack.has(key)) fail("El 3MF tiene piezas que se referencian en círculo.");
    const obj = getDoc(path).objects.get(objectId);
    if (!obj) return fail("El 3MF referencia una pieza que no existe.");
    if (obj.type === "other") return;
    stack.add(key);
    if (obj.mesh && obj.mesh.triCount > 0) instances.push({ mesh: obj.mesh, matrix });
    for (const c of obj.components) expand(c.path ?? path, c.objectId, compose(c.matrix, matrix), depth + 1);
    stack.delete(key);
  };

  let items = root.items;
  if (!items || items.length === 0) {
    // Sin `<build>`: todos los objetos que no son parte de otro.
    const used = new Set<string>();
    for (const obj of root.objects.values()) for (const c of obj.components) if (!c.path) used.add(c.objectId);
    items = [...root.objects.keys()].filter((id) => !used.has(id)).map((objectId) => ({ objectId, path: null, matrix: null }));
  }
  for (const item of items) expand(item.path ?? rootPath, item.objectId, item.matrix, 0);

  let total = 0;
  for (const inst of instances) total += inst.mesh.triCount;
  if (total === 0) fail("El 3MF no tiene ninguna pieza.");

  const u = root.unitMm;
  const positions = new Float32Array(total * 9);
  let k = 0;
  for (const { mesh, matrix: m } of instances) {
    const { verts, tris, triCount } = mesh;
    // Una transformación espejada invierte el sentido de los triángulos.
    const flip = m !== null && determinant(m) < 0;
    for (let t = 0; t < triCount; t++) {
      for (let j = 0; j < 3; j++) {
        const vi = tris[t * 3 + (flip && j > 0 ? 3 - j : j)] * 3;
        const x = verts[vi];
        const y = verts[vi + 1];
        const z = verts[vi + 2];
        if (m) {
          positions[k++] = (x * m[0] + y * m[3] + z * m[6] + m[9]) * u;
          positions[k++] = (x * m[1] + y * m[4] + z * m[7] + m[10]) * u;
          positions[k++] = (x * m[2] + y * m[5] + z * m[8] + m[11]) * u;
        } else {
          positions[k++] = x * u;
          positions[k++] = y * u;
          positions[k++] = z * u;
        }
      }
    }
  }
  return { positions, triangles: total };
}

/* ---------------------------------------------------------- por nombre */

/** "pieza.STL" → "stl". Otras extensiones → null. */
export function detectFormat(fileName: string): ModelFormat | null {
  const ext = fileName.trim().toLowerCase().split(".").pop();
  return ext === "stl" || ext === "3mf" ? ext : null;
}

function isZip(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const b = new Uint8Array(buf, 0, 4);
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

/** Lee según la extensión. Lanza `ModelParseError` con el mensaje para el cliente. */
export function parseModel(buf: ArrayBuffer, fileName: string): Mesh {
  const format = detectFormat(fileName);
  if (!format) fail("Sólo aceptamos archivos STL o 3MF.");
  if (buf.byteLength === 0) fail("El archivo está vacío.");
  try {
    // Un .stl que en realidad es un zip casi seguro es un 3MF renombrado.
    return format === "3mf" || isZip(buf) ? parse3mf(buf) : parseStl(buf);
  } catch (err) {
    if (err instanceof ModelParseError) throw err;
    if (err instanceof RangeError) fail("El archivo es demasiado pesado para procesarlo acá. Probá con uno más liviano.");
    return fail("No pudimos leer el archivo. Probá exportarlo de nuevo.");
  }
}

/* ------------------------------------------------------------- análisis */

/** Tolerancia de soldado de vértices: 1e-4 mm. */
const WELD_SCALE = 1e4;

/** Hash de 32 bits de un vértice cuantizado. */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  return h ^ (h >>> 16);
}

function nextPow2(n: number): number {
  let p = 1024;
  while (p < n) p *= 2;
  return p;
}

/** Suelda vértices cuantizados y devuelve el id de cada esquina (3 por triángulo). */
function weldVertices(p: Float32Array, n: number): { ids: Int32Array; count: number } {
  const ids = new Int32Array(n * 3);
  let cap = nextPow2(n * 2);
  let mask = cap - 1;
  let table = new Int32Array(cap); // id + 1; 0 = vacío
  let keys = new Float64Array(Math.max(1024, Math.ceil(n * 1.5)) * 3);
  let count = 0;

  for (let v = 0; v < n * 3; v++) {
    const qx = Math.round(p[v * 3] * WELD_SCALE);
    const qy = Math.round(p[v * 3 + 1] * WELD_SCALE);
    const qz = Math.round(p[v * 3 + 2] * WELD_SCALE);
    let slot = hash3(qx, qy, qz) & mask;
    let id = -1;
    for (;;) {
      const e = table[slot];
      if (e === 0) break;
      const k = (e - 1) * 3;
      if (keys[k] === qx && keys[k + 1] === qy && keys[k + 2] === qz) {
        id = e - 1;
        break;
      }
      slot = (slot + 1) & mask;
    }
    if (id < 0) {
      id = count++;
      if (id * 3 + 3 > keys.length) {
        const next = new Float64Array(keys.length * 2);
        next.set(keys);
        keys = next;
      }
      keys[id * 3] = qx;
      keys[id * 3 + 1] = qy;
      keys[id * 3 + 2] = qz;
      table[slot] = id + 1;
      // Factor de carga ≤ 0,5: se agranda la tabla y se re-hashea.
      if (count * 2 > cap) {
        cap *= 2;
        mask = cap - 1;
        table = new Int32Array(cap);
        for (let i = 0; i < count; i++) {
          let s = hash3(keys[i * 3], keys[i * 3 + 1], keys[i * 3 + 2]) & mask;
          while (table[s] !== 0) s = (s + 1) & mask;
          table[s] = i + 1;
        }
      }
    }
    ids[v] = id;
  }
  return { ids, count };
}

/** Ordena `a[from..to)` en el lugar (tramos chicos: inserción). */
function sortRange(a: Int32Array, from: number, to: number) {
  if (to - from > 32) {
    a.subarray(from, to).sort();
    return;
  }
  for (let i = from + 1; i < to; i++) {
    const v = a[i];
    let j = i - 1;
    while (j >= from && a[j] > v) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = v;
  }
}

/**
 * Cada arista la comparten exactamente 2 triángulos. Aristas agrupadas por
 * su vértice menor (CSR), sin mapas ni strings. Los triángulos degenerados
 * (dos esquinas soldadas en el mismo vértice) no cuentan.
 */
function isManifold(p: Float32Array, n: number): boolean {
  if (n < 4) return false;
  const { ids, count } = weldVertices(p, n);
  const start = new Int32Array(count + 1);
  let edges = 0;
  for (let t = 0; t < n; t++) {
    const a = ids[t * 3];
    const b = ids[t * 3 + 1];
    const c = ids[t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    start[(a < b ? a : b) + 1]++;
    start[(b < c ? b : c) + 1]++;
    start[(c < a ? c : a) + 1]++;
    edges += 3;
  }
  if (edges === 0) return false;
  for (let v = 0; v < count; v++) start[v + 1] += start[v];
  const cursor = start.slice(0, count);
  const other = new Int32Array(edges);
  for (let t = 0; t < n; t++) {
    const a = ids[t * 3];
    const b = ids[t * 3 + 1];
    const c = ids[t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    if (a < b) other[cursor[a]++] = b;
    else other[cursor[b]++] = a;
    if (b < c) other[cursor[b]++] = c;
    else other[cursor[c]++] = b;
    if (c < a) other[cursor[c]++] = a;
    else other[cursor[a]++] = c;
  }
  for (let v = 0; v < count; v++) {
    const from = start[v];
    const to = start[v + 1];
    if ((to - from) % 2 !== 0) return false;
    sortRange(other, from, to);
    for (let i = from; i < to; i += 2) {
      if (other[i] !== other[i + 1]) return false;
      if (i + 2 < to && other[i + 2] === other[i]) return false;
    }
  }
  return true;
}

const round3 = (x: number) => roundTo(x, 3);

/**
 * Volumen (|Σ tetraedros firmados|), área, caja y estanqueidad. Los valores
 * van redondeados a 3 decimales (mm³, mm², mm) para que TS y SQL partan de
 * los mismos números.
 */
export function analyzeMesh(mesh: Mesh): Geometry {
  const p = mesh.positions;
  const n = Math.min(mesh.triangles, Math.floor(p.length / 9));
  if (n === 0) return { volume_mm3: 0, area_mm2: 0, bbox: [0, 0, 0], triangles: 0, manifold: false };

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  const len = n * 9;
  for (let i = 0; i < len; i += 3) {
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  // Centrado en la caja: menos error numérico en piezas lejos del origen.
  const ox = (minX + maxX) / 2;
  const oy = (minY + maxY) / 2;
  const oz = (minZ + maxZ) / 2;

  let vol6 = 0;
  let area2 = 0;
  for (let i = 0; i < len; i += 9) {
    const ax = p[i] - ox;
    const ay = p[i + 1] - oy;
    const az = p[i + 2] - oz;
    const bx = p[i + 3] - ox;
    const by = p[i + 4] - oy;
    const bz = p[i + 5] - oz;
    const cx = p[i + 6] - ox;
    const cy = p[i + 7] - oy;
    const cz = p[i + 8] - oz;
    vol6 += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    area2 += Math.sqrt(nx * nx + ny * ny + nz * nz);
  }

  return {
    volume_mm3: round3(Math.abs(vol6) / 6),
    area_mm2: round3(area2 / 2),
    bbox: [round3(maxX - minX), round3(maxY - minY), round3(maxZ - minZ)],
    triangles: n,
    manifold: isManifold(p, n),
  };
}

/** Escala uniforme: volumen × f³, área × f², caja × f. */
export function scaleGeometry(g: Geometry, factor: number): Geometry {
  const f = factor;
  return {
    volume_mm3: round3(g.volume_mm3 * f * f * f),
    area_mm2: round3(g.area_mm2 * f * f),
    bbox: [round3(g.bbox[0] * f), round3(g.bbox[1] * f), round3(g.bbox[2] * f)],
    triangles: g.triangles,
    manifold: g.manifold,
  };
}

/* -------------------------------------------------------------- unidades */

const UNIT_FACTORS: Record<LengthUnit, number> = { mm: 1, cm: 10, in: 25.4 };

/** mm = 1, cm = 10, in = 25,4. */
export function unitFactor(unit: LengthUnit): number {
  return UNIT_FACTORS[unit];
}

/**
 * El STL no trae unidades. Si la medida mayor es < 3 lo más probable es que
 * se haya exportado en cm (o pulgadas): se sugiere "cm" con aviso en la UI.
 */
export function suggestUnit(bbox: [number, number, number]): LengthUnit | null {
  const max = Math.max(bbox[0], bbox[1], bbox[2]);
  return max > 0 && max < 3 ? "cm" : null;
}
