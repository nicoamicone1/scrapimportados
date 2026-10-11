/**
 * Ilustraciones de producto para el seed: un dibujo de moda «flat» técnico
 * (vista frontal) de la prenda, relleno con el color del swatch, contorno
 * tinta, pespuntes, sombras planas de pliegue y textura según el tejido, sobre
 * el fondo claro de la marca con una luna detrás (la fase cambia por
 * producto) y una órbita fina. Abajo dice «Ilustración · <Color>»: no son
 * fotos y se tiene que notar.
 *
 * SVG 800 × 1000 (4:5, como placeholder-svg.mts), sin fuentes externas ni
 * scripts. Puro: no lee ni escribe archivos.
 *
 *   garmentKind(nombre)  → tipo de prenda reconocido, o null
 *   garmentSvg({ name, color, hex, seed }) → el SVG, o null si no es prenda
 */

export type GarmentKind =
  | "tee"
  | "teeStriped"
  | "teeOversize"
  | "tank"
  | "longsleeve"
  | "turtleneck"
  | "hoodie"
  | "sweatshirt"
  | "cardigan"
  | "jacket"
  | "puffer"
  | "coat"
  | "pantsStraight"
  | "pantsCord"
  | "pantsWide"
  | "jogger"
  | "pantsTailored"
  | "dressShirt"
  | "dressMidi"
  | "dressShort"
  | "dressSlip"
  | "dressKnit"
  | "shirtLoose"
  | "shirtClassic"
  | "blouseRuffle"
  | "blouseBow"
  | "scarfSilk"
  | "scarfKnit"
  | "socks";

export interface GarmentInput {
  /** Nombre del producto («Buzo canguro de frisa»): define la prenda y el tejido. */
  name: string;
  /** Valor de la opción Color («Rayas azules»); vacío si el producto no tiene colores. */
  color?: string;
  /** Hex del swatch (#RRGGBB). En «Rayas …» es el color de la raya; en «Floral …», el fondo. */
  hex: string;
  /** Semilla estable por producto (el slug): elige la fase de la luna. */
  seed?: string;
}

const W = 800;
const H = 1000;
const CX = 400;
const INK = "#15133A";
const CRUDO = "#EAE2D2";
const FALLBACK = "#C9C5DA";

// ---------------------------------------------------------------------------
// Detección
// ---------------------------------------------------------------------------

function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Tipo de prenda por el nombre del producto (null si no se reconoce). */
export function garmentKind(name: string): GarmentKind | null {
  const n = norm(name);
  if (/panuelo|foulard/.test(n)) return "scarfSilk";
  if (/bufanda|cuello tejido/.test(n)) return "scarfKnit";
  if (/\bmedias?\b|soquetes/.test(n)) return "socks";
  if (/buzo/.test(n)) return /canguro|capucha|hoodie/.test(n) ? "hoodie" : "sweatshirt";
  if (/hoodie|canguro/.test(n)) return "hoodie";
  if (/\bsaco\b|cardigan|chaleco tejido/.test(n)) return "cardigan";
  if (/campera|chaqueta|parka/.test(n)) return /inflable|puffer|pluma/.test(n) ? "puffer" : "jacket";
  if (/tapado|abrigo|sobretodo|trench/.test(n)) return "coat";
  if (/pantalon|jean|jogging|jogger|palazzo/.test(n)) {
    if (/palazzo|ancho|wide|oxford|amplio/.test(n)) return "pantsWide";
    if (/jogger|jogging|frisa|puno|babucha/.test(n)) return "jogger";
    if (/sastrero|pinzas|vestir/.test(n)) return "pantsTailored";
    if (/corderoy|pana/.test(n)) return "pantsCord";
    return "pantsStraight";
  }
  if (/vestido/.test(n)) {
    if (/camisero/.test(n)) return "dressShirt";
    if (/bretel|slip|lencero/.test(n)) return "dressSlip";
    if (/punto|acanalad|tejido/.test(n)) return "dressKnit";
    if (/corto|mini/.test(n)) return "dressShort";
    return "dressMidi";
  }
  if (/blusa|volado/.test(n)) return /lazo|mono/.test(n) ? "blouseBow" : "blouseRuffle";
  if (/camisa/.test(n)) {
    if (/lazo|mono/.test(n)) return "blouseBow";
    if (/holgad|oversize|lino/.test(n)) return "shirtLoose";
    return "shirtClassic";
  }
  if (/musculosa|\btop\b|camiseta sin mangas/.test(n)) return "tank";
  if (/cuello alto|polera/.test(n)) return "turtleneck";
  if (/remera|camiseta|t-shirt/.test(n)) {
    if (/rayad|marinera|a rayas/.test(n)) return "teeStriped";
    if (/manga larga/.test(n)) return "longsleeve";
    if (/oversize|holgad|boxy/.test(n)) return "teeOversize";
    return "tee";
  }
  return null;
}

type Fabric =
  | "rib"
  | "cord"
  | "linen"
  | "twill"
  | "cable"
  | "knit"
  | "felt"
  | "plain";

/** Tejido del cuerpo de la prenda (la textura de fondo). */
function fabricOf(name: string): Fabric {
  const n = norm(name);
  if (/trenzad|ochos/.test(n)) return "cable";
  if (/corderoy|pana/.test(n)) return "cord";
  if (/acanalad|morley|\brib\b/.test(n)) return "rib";
  if (/lino/.test(n)) return "linen";
  if (/gabardina|sarga/.test(n)) return "twill";
  if (/lana|tejid/.test(n)) return "knit";
  if (/pano|lana/.test(n)) return "felt";
  return "plain";
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = Number.parseInt(m ? m[1] : FALLBACK.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function luminance(hex: string): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Muy oscuro: las líneas interiores van claras (la tinta no se leería). */
function isDark(hex: string): boolean {
  return luminance(hex) < 0.06;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Semilla y fases
// ---------------------------------------------------------------------------

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Fase de la luna (0 nueva … 4 llena … 7 menguante) estable por semilla. */
export function moonPhase(seed: string): number {
  return hash(seed) % 8;
}

/** Parte iluminada de un disco en la fase `i` de 8 (vacío en luna nueva). */
function litPath(cx: number, cy: number, r: number, i: number): string {
  const k = (((i % 8) + 8) % 8) / 8;
  if (k === 0) return "";
  if (k === 0.5) return `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
  const rx = Math.abs(Math.cos(2 * Math.PI * k)) * r;
  const top = `${f(cx)} ${f(cy - r)}`;
  const bottom = `${f(cx)} ${f(cy + r)}`;
  if (k < 0.5) {
    // Creciente: ilumina la derecha; el terminador se curva a la derecha (finita) o a la izquierda (gibosa).
    return `M${top}A${f(r)} ${f(r)} 0 0 1 ${bottom}A${f(rx)} ${f(r)} 0 0 ${k < 0.25 ? 0 : 1} ${top}Z`;
  }
  return `M${top}A${f(r)} ${f(r)} 0 0 0 ${bottom}A${f(rx)} ${f(r)} 0 0 ${k < 0.75 ? 0 : 1} ${top}Z`;
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

type P = [number, number];
/** Segmento: [fin] recta, [control, fin] cuadrática, [c1, c2, fin] cúbica. */
type Seg = [P] | [P, P] | [P, P, P];

function f(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function pt(p: P): string {
  return `${f(p[0])} ${f(p[1])}`;
}

function mx(p: P): P {
  return [W - p[0], p[1]];
}

function add(a: P, b: P, k = 1): P {
  return [a[0] + b[0] * k, a[1] + b[1] * k];
}

function lerp(a: P, b: P, t: number): P {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function segCmd(s: Seg): string {
  if (s.length === 1) return `L${pt(s[0])}`;
  if (s.length === 2) return `Q${pt(s[0])} ${pt(s[1])}`;
  return `C${pt(s[0])} ${pt(s[1])} ${pt(s[2])}`;
}

/**
 * Silueta simétrica: se dibuja la mitad derecha (de `start` a un punto final,
 * idealmente sobre el eje x = 400) y se completa espejada.
 */
function sym(start: P, segs: Seg[]): string {
  let d = `M${pt(start)}`;
  const pts: P[] = [start];
  for (const s of segs) {
    d += segCmd(s);
    pts.push(s[s.length - 1]);
  }
  const end = pts[pts.length - 1];
  if (Math.abs(end[0] - CX) > 0.01) d += `L${pt(mx(end))}`;
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const to = mx(pts[i]);
    if (s.length === 1) d += `L${pt(to)}`;
    else if (s.length === 2) d += `Q${pt(mx(s[0]))} ${pt(to)}`;
    else d += `C${pt(mx(s[1]))} ${pt(mx(s[0]))} ${pt(to)}`;
  }
  return `${d}Z`;
}

/** Path abierto (o cerrado) a partir de un punto y segmentos, sin espejar. */
function path(start: P, segs: Seg[], close = false): string {
  return `M${pt(start)}${segs.map(segCmd).join("")}${close ? "Z" : ""}`;
}

const ARITY: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, S: 4, T: 2, A: 7, H: 1, V: 1, Z: 0 };

/** Espeja un path sobre el eje x = 400 (comandos absolutos y relativos). */
function mirrorD(d: string): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const out: string[] = [];
  let cmd = "";
  let args: number[] = [];
  const flush = () => {
    const a = args.slice();
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    const fx = (x: number) => (rel ? -x : W - x);
    if (up === "A") {
      a[2] = -a[2];
      a[4] = 1 - a[4];
      a[5] = fx(a[5]);
    } else if (up === "H") a[0] = fx(a[0]);
    else if (up !== "V") for (let i = 0; i < a.length; i += 2) a[i] = fx(a[i]);
    out.push(a.map(f).join(" "));
    args = [];
  };
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      out.push(cmd);
      continue;
    }
    args.push(Number(t));
    if (args.length === ARITY[cmd.toUpperCase()]) {
      flush();
      if (cmd === "M") cmd = "L";
      else if (cmd === "m") cmd = "l";
    }
  }
  return out.join("").replace(/([A-Za-z])\s/g, "$1");
}

/** El path más su espejo. */
function both(d: string): string {
  return `${d}${mirrorD(d)}`;
}

/** Pliegue: una lente fina de `a` a `b`, panza de ancho `w` hacia un lado. */
function fold(a: P, b: P, w: number): string {
  const m = lerp(a, b, 0.5);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const n: P = [-dy / len, dx / len];
  return `M${pt(a)}Q${pt(add(m, n, w))} ${pt(b)}Q${pt(add(m, n, w * 0.15))} ${pt(a)}Z`;
}

/** Segmentos de `a` a `b` partidos en `n` tramos abombados hacia afuera (`amt` px). */
function bulge(a: P, b: P, n: number, amt: number): Seg[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const out: P = [dy / len, -dx / len];
  const segs: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = lerp(a, b, i / n);
    const p1 = lerp(a, b, (i + 1) / n);
    segs.push([add(lerp(p0, p1, 0.5), out, amt), p1]);
  }
  return segs;
}

// ---------------------------------------------------------------------------
// Texturas
// ---------------------------------------------------------------------------

type Tone = "d" | "l";

class Defs {
  private items = new Map<string, string>();

  has(id: string): boolean {
    return this.items.has(id);
  }

  add(id: string, svg: string): string {
    if (!this.items.has(id)) this.items.set(id, svg);
    return id;
  }

  toString(): string {
    return [...this.items.values()].join("");
  }

  /** Textura de tejido para un relleno (líneas tinta en claros, claras en oscuros). */
  fabric(kind: Exclude<Fabric, "plain"> | "ribS" | "heather" | "sherpa", fill: string): string {
    const tone: Tone = isDark(fill) ? "l" : "d";
    const c = tone === "l" ? "#FFFFFF" : INK;
    const o = tone === "l" ? 0.1 : 0.11;
    const id = `${kind}${tone}`;
    if (this.has(id)) return id;
    const open = (w: number, h: number) => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">`;
    let body = "";
    switch (kind) {
      case "rib":
        body = `${open(11, 20)}<path d="M5.5 0V20" stroke="${c}" stroke-opacity="${o * 1.2}" stroke-width="3"/><path d="M9.6 0V20" stroke="#FFFFFF" stroke-opacity="${tone === "l" ? 0.04 : 0.16}" stroke-width="1.2"/></pattern>`;
        break;
      case "ribS":
        body = `${open(7, 20)}<path d="M3.5 0V20" stroke="${c}" stroke-opacity="${o * 1.5}" stroke-width="2.2"/></pattern>`;
        break;
      case "cord":
        body = `${open(17, 20)}<rect width="6" height="20" fill="${c}" fill-opacity="${o * 1.1}"/><path d="M12 0V20" stroke="#FFFFFF" stroke-opacity="${tone === "l" ? 0.07 : 0.22}" stroke-width="2.4"/></pattern>`;
        break;
      case "linen":
        body = `${open(9, 9)}<path d="M0 2.5H9M6.5 0V9" stroke="${c}" stroke-opacity="${o * 0.55}" stroke-width="1"/><path d="M0 7H4" stroke="${c}" stroke-opacity="${o * 0.8}" stroke-width="1.2"/></pattern>`;
        break;
      case "twill":
        body = `${open(9, 9)}<path d="M-1 10L10 -1M-1 1L1 -1M8 10L10 8" stroke="${c}" stroke-opacity="${o * 0.6}" stroke-width="1.3"/></pattern>`;
        break;
      case "felt":
        body = `${open(14, 14)}<circle cx="3" cy="4" r="1" fill="${c}" fill-opacity="${o * 0.7}"/><circle cx="10" cy="10" r=".9" fill="${c}" fill-opacity="${o * 0.6}"/><circle cx="11" cy="2" r=".8" fill="#FFFFFF" fill-opacity="${o}"/></pattern>`;
        break;
      case "heather":
        body = `${open(12, 12)}<path d="M1 2h3M7 6h3M3 9h2.5M9 11h2" stroke="#FFFFFF" stroke-opacity=".26" stroke-width="1.2"/><path d="M5 3h2M0 7h2M8 1h2M6 10h2" stroke="${INK}" stroke-opacity=".12" stroke-width="1.2"/></pattern>`;
        break;
      case "knit":
        body = `${open(12, 11)}<path d="M1 1L6 8L11 1" fill="none" stroke="${c}" stroke-opacity="${o * 1.3}" stroke-width="1.8" stroke-linejoin="round"/></pattern>`;
        break;
      case "cable":
        body =
          `${open(64, 76)}<path d="M6 0V76M58 0V76" stroke="${c}" stroke-opacity="${o * 1.3}" stroke-width="3"/>` +
          `<path d="M20 0C20 19 44 19 44 38C44 57 20 57 20 76" fill="none" stroke="${c}" stroke-opacity="${o * 1.6}" stroke-width="7" stroke-linecap="round"/>` +
          `<path d="M44 0C44 19 20 19 20 38C20 57 44 57 44 76" fill="none" stroke="${c}" stroke-opacity="${o * 1.6}" stroke-width="7" stroke-linecap="round"/>` +
          `<path d="M44 0C44 19 20 19 20 38C20 57 44 57 44 76" fill="none" stroke="#FFFFFF" stroke-opacity="${tone === "l" ? 0.08 : 0.28}" stroke-width="2.4"/>` +
          `<path d="M14 0V76M50 0V76" stroke="${c}" stroke-opacity="${o * 0.8}" stroke-width="1.4"/></pattern>`;
        break;
      case "sherpa":
        body = `${open(16, 14)}<path d="M2 6q3-4 6 0M10 13q3-4 6 0M10 4q2-3 4 0M1 13q2-3 4 0" fill="none" stroke="${INK}" stroke-opacity=".16" stroke-width="1.4" stroke-linecap="round"/></pattern>`;
        break;
    }
    return this.add(id, body);
  }

  /** Rayas marineras: `stripe` sobre `ground`. */
  stripes(stripe: string): string {
    return this.add("stripes", `<pattern id="stripes" width="40" height="34" patternUnits="userSpaceOnUse"><rect y="8" width="40" height="13" fill="${stripe}"/></pattern>`);
  }

  /** Floral chico repetido, sobre el color de fondo del swatch. */
  floral(bg: string): string {
    const [r, , b] = rgb(bg);
    const petal = "#F4ECDD";
    const center = b > r ? "#E3B04B" : "#6B1E2A";
    const leaf = mix(bg, "#FFFFFF", 0.42);
    const flower = (x: number, y: number, s: number) => {
      let out = "";
      for (let k = 0; k < 5; k++) {
        const a = (k * 72 - 90) * (Math.PI / 180);
        out += `<circle cx="${f(x + Math.cos(a) * s)}" cy="${f(y + Math.sin(a) * s)}" r="${f(s * 0.72)}"/>`;
      }
      return `<g fill="${petal}">${out}</g><circle cx="${x}" cy="${y}" r="${f(s * 0.5)}" fill="${center}"/>`;
    };
    const leafAt = (x: number, y: number, rot: number) =>
      `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="2.6" transform="rotate(${rot} ${x} ${y})" fill="${leaf}"/>`;
    return this.add(
      "floral",
      `<pattern id="floral" width="60" height="60" patternUnits="userSpaceOnUse">` +
        leafAt(27, 9, 35) +
        leafAt(7, 40, -40) +
        leafAt(52, 30, 70) +
        flower(15, 16, 6) +
        flower(44, 46, 5.4) +
        `<g fill="${petal}"><circle cx="50" cy="12" r="2.2"/><circle cx="22" cy="49" r="2.2"/><circle cx="34" cy="29" r="1.4"/></g></pattern>`,
    );
  }
}

// ---------------------------------------------------------------------------
// Capas
// ---------------------------------------------------------------------------

interface Layer {
  d: string;
  /** Relleno (hex). Por defecto, el color base de la prenda. */
  fill?: string;
  /** Id de un <pattern> para superponer (textura). */
  tex?: string | null;
  /** Sombras planas de pliegue (dentro de la capa). */
  folds?: string;
  /** Realces claros. */
  lights?: string;
  /** Costuras y líneas interiores. */
  lines?: string;
  /** Pespuntes (punteados). */
  stitch?: string;
  /** Botones. */
  dots?: P[];
  /** Radio de los botones. */
  dotR?: number;
  /** Transparencia (gasa). */
  opacity?: number;
  /** Transformación de la capa (medias, pañuelo). */
  tf?: string;
}

interface Ctx {
  base: string;
  defs: Defs;
  tex: string | null;
  fabric: Fabric;
  name: string;
}

function renderGarment(layers: Layer[], ctx: Ctx): string {
  const ids = layers.map((_, i) => `g${i}`);
  const defs = layers.map((l, i) => `<path id="${ids[i]}" d="${l.d}"/>`).join("");
  const useOf = (i: number, attrs = "") => {
    const tf = layers[i].tf ? ` transform="${layers[i].tf}"` : "";
    return `<use href="#${ids[i]}"${tf}${attrs}/>`;
  };
  const shadow = `<g transform="translate(12 16)" fill="${INK}" fill-opacity=".07">${layers.map((_, i) => useOf(i)).join("")}</g>`;
  const outline =
    `<g fill="${INK}" stroke="${INK}" stroke-width="7" stroke-linejoin="round">` +
    layers.map((l, i) => useOf(i, l.opacity ? ` fill="none"` : "")).join("") +
    `</g>`;
  const body = layers
    .map((l, i) => {
      const fill = l.fill ?? ctx.base;
      const dark = isDark(fill);
      const line = dark ? mix(fill, "#FFFFFF", 0.38) : INK;
      const lineO = dark ? 1 : 0.88;
      const shade = dark ? `fill="#FFFFFF" fill-opacity=".06"` : `fill="${INK}" fill-opacity=".12"`;
      const light = `fill="#FFFFFF" fill-opacity="${dark ? 0.08 : 0.22}"`;
      const tf = l.tf ? ` transform="${l.tf}"` : "";
      const op = l.opacity ? ` opacity="${l.opacity}"` : "";
      let g = `<g${tf}${op}><use href="#${ids[i]}" fill="${fill}"/>`;
      if (l.tex) g += `<use href="#${ids[i]}" fill="url(#${l.tex})"/>`;
      if (l.folds) g += `<path d="${l.folds}" ${shade}/>`;
      if (l.lights) g += `<path d="${l.lights}" ${light}/>`;
      g += `<use href="#${ids[i]}" fill="none" stroke="${line}" stroke-opacity="${lineO}" stroke-width="2.2" stroke-linejoin="round"/>`;
      if (l.lines) g += `<path d="${l.lines}" fill="none" stroke="${line}" stroke-opacity="${lineO}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (l.stitch)
        g += `<path d="${l.stitch}" fill="none" stroke="${line}" stroke-opacity="${dark ? 0.8 : 0.62}" stroke-width="1.6" stroke-dasharray="5 4.5" stroke-linecap="round"/>`;
      if (l.dots?.length) {
        const r = l.dotR ?? 6;
        const btn = dark ? mix(fill, "#FFFFFF", 0.2) : mix(fill, INK, 0.12);
        g += `<g fill="${btn}" stroke="${line}" stroke-width="1.8">${l.dots.map((p) => `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}"/>`).join("")}</g>`;
        g += `<g fill="${line}" fill-opacity=".7">${l.dots.map((p) => `<circle cx="${f(p[0] - r * 0.28)}" cy="${f(p[1])}" r="1"/><circle cx="${f(p[0] + r * 0.28)}" cy="${f(p[1])}" r="1"/>`).join("")}</g>`;
      }
      return `${g}</g>`;
    })
    .join("");
  return `<defs>${defs}</defs>${shadow}${outline}${body}`;
}

// ---------------------------------------------------------------------------
// Partes superiores (remeras, buzos, camisas, vestidos, abrigos)
// ---------------------------------------------------------------------------

interface TopSpec {
  /** Escote: medio ancho en el hombro, altura del hombro-cuello, caída del cuello de atrás y profundidad adelante. */
  neck: { w: number; y: number; back: number; front: number };
  /** Punta del hombro (derecha). */
  sh: P;
  /** Manga: largo, ángulo desde la vertical (grados) y ancho en el puño. */
  sleeve?: { len: number; ang: number; w: number; puff?: number };
  /** Sisa: donde la manga se une al costado. */
  under: P;
  waist?: P;
  hem: P;
  /** Cuánto baja el ruedo en el centro (curva). */
  hemCurve?: number;
  /** Mangas como capas aparte (gasa). */
  separateSleeves?: boolean;
  /** Matelaseado: cantidad de tramos en el costado y en la manga. */
  quilt?: { body: number; sleeve: number };
  /** Manga ranglan (costura del cuello a la sisa). */
  raglan?: boolean;
}

interface TopGeo {
  d: string;
  N: P;
  O?: P;
  I?: P;
  dir?: P;
  /** Sleeve polygons when separated (right side only). */
  sleeveD?: string;
}

function sleeveGeo(s: TopSpec): { O: P; I: P; dir: P } | null {
  if (!s.sleeve) return null;
  const a = (s.sleeve.ang * Math.PI) / 180;
  const dir: P = [Math.sin(a), Math.cos(a)];
  const O = add(s.sh, dir, s.sleeve.len);
  const I = add(O, [-Math.cos(a), Math.sin(a)], s.sleeve.w);
  return { O, I, dir };
}

function topGeo(s: TopSpec): TopGeo {
  const N: P = [CX + s.neck.w, s.neck.y];
  const backY = s.neck.y + s.neck.back;
  const U = s.under;
  const Hm = s.hem;
  const hc = s.hemCurve ?? 0;
  const sg = sleeveGeo(s);
  const segs: Seg[] = [[[CX + s.neck.w * 0.6, backY], N], [s.sh]];
  let sleeveD: string | undefined;
  if (sg && !s.separateSleeves) {
    if (s.quilt) {
      segs.push(...bulge(s.sh, sg.O, s.quilt.sleeve, 7));
      segs.push([sg.I]);
      segs.push(...bulge(sg.I, U, s.quilt.sleeve, 6));
    } else if (s.sleeve?.puff) {
      segs.push([add(lerp(s.sh, sg.O, 0.45), [s.sleeve.puff, -s.sleeve.puff * 0.3]), sg.O], [sg.I], [U]);
    } else segs.push([sg.O], [sg.I], [U]);
  } else {
    // Sisa (musculosa, o manga aparte).
    segs.push([[s.sh[0] + 4, s.sh[1] + 54], [U[0] - 30, U[1] - 4], U]);
    if (sg) sleeveD = path(s.sh, [[sg.O], [sg.I], [U], [[U[0] - 30, U[1] - 4], [s.sh[0] + 4, s.sh[1] + 54], s.sh]], true);
  }
  if (s.quilt) {
    segs.push(...bulge(U, Hm, s.quilt.body, 7));
  } else if (s.waist) {
    const Wt = s.waist;
    segs.push([[U[0], U[1] + (Wt[1] - U[1]) * 0.45], [Wt[0], Wt[1] - (Wt[1] - U[1]) * 0.3], Wt]);
    segs.push([[Wt[0], Wt[1] + (Hm[1] - Wt[1]) * 0.3], [Hm[0], Hm[1] - (Hm[1] - Wt[1]) * 0.5], Hm]);
  } else {
    segs.push([[U[0], U[1] + (Hm[1] - U[1]) * 0.4], [Hm[0], Hm[1] - (Hm[1] - U[1]) * 0.4], Hm]);
  }
  segs.push([[CX + (Hm[0] - CX) * 0.5, Hm[1] + hc], [CX, Hm[1] + hc]]);
  return { d: sym([CX, backY], segs), N, O: sg?.O, I: sg?.I, dir: sg?.dir, sleeveD };
}

/** Interior del escote (la espalda que se ve por adentro). */
function neckOpening(s: TopSpec, front = s.neck.front): string {
  const N: P = [CX + s.neck.w, s.neck.y];
  const backY = s.neck.y + s.neck.back;
  return sym([CX, backY], [
    [[CX + s.neck.w * 0.6, backY], N],
    [[N[0] + 1, N[1] + (front - N[1]) * 0.55], [CX + s.neck.w * 0.5, front], [CX, front]],
  ]);
}

/** Cuello redondo: tira acanalada de ancho `bw` siguiendo el escote. */
function neckBand(s: TopSpec, bw: number): string {
  const N: P = [CX + s.neck.w, s.neck.y];
  const fr = s.neck.front;
  return sym([CX, fr], [
    [[CX + s.neck.w * 0.5, fr], [N[0] + 1, N[1] + (fr - N[1]) * 0.55], N],
    [[N[0] + bw, N[1] + 2]],
    [[N[0] + bw + 1, N[1] + (fr + bw - N[1]) * 0.55], [CX + (s.neck.w + bw) * 0.5, fr + bw], [CX, fr + bw]],
  ]);
}

/** Escote en V: tira de ancho `bw` del hombro a la punta. */
function vBand(s: TopSpec, bw: number): string {
  const N: P = [CX + s.neck.w, s.neck.y];
  const fr = s.neck.front;
  return sym([CX, fr], [[[CX + s.neck.w * 0.3, fr - (fr - N[1]) * 0.3], N], [[N[0] + bw, N[1] + 3]], [[CX + s.neck.w * 0.3 + bw, fr - (fr - N[1]) * 0.3 + bw * 0.6], [CX, fr + bw * 1.3]]]);
}

/** Puño: banda al final de la manga (derecha), de largo `c`. */
function cuffD(g: TopGeo, c: number, pinch = 0): string {
  if (!g.O || !g.I || !g.dir) return "";
  const O2 = add(g.O, g.dir, -c);
  const I2 = add(g.I, g.dir, -c);
  const inward = lerp(g.O, g.I, 0.5);
  const O1 = pinch ? lerp(g.O, inward, pinch) : g.O;
  const I1 = pinch ? lerp(g.I, inward, pinch) : g.I;
  return `M${pt(O2)}L${pt(O1)}L${pt(I1)}L${pt(I2)}Z`;
}

/** Línea a lo ancho de la manga a distancia `c` del puño (pespunte de ruedo). */
function acrossSleeve(g: TopGeo, c: number): string {
  if (!g.O || !g.I || !g.dir) return "";
  return `M${pt(add(g.O, g.dir, -c))}L${pt(add(g.I, g.dir, -c))}`;
}

/** Banda inferior (cintura acanalada / pretina) de alto `bh`. */
function hemBand(s: TopSpec, bh: number, flare = 0): string {
  const Hm = s.hem;
  const hc = s.hemCurve ?? 0;
  return sym([CX, Hm[1] + hc - bh], [
    [[CX + (Hm[0] - CX) * 0.5, Hm[1] + hc - bh], [Hm[0] + flare, Hm[1] - bh]],
    [Hm],
    [[CX + (Hm[0] - CX) * 0.5, Hm[1] + hc], [CX, Hm[1] + hc]],
  ]);
}

function hemLine(s: TopSpec, off: number): string {
  const Hm = s.hem;
  const hc = s.hemCurve ?? 0;
  const half = path([Hm[0] - 2, Hm[1] - off], [[[CX + (Hm[0] - CX) * 0.5, Hm[1] + hc - off], [CX, Hm[1] + hc - off]]]);
  return both(half);
}

function armholeLine(s: TopSpec): string {
  const U = s.under;
  if (s.raglan) return both(path([CX + s.neck.w + 14, s.neck.y + 8], [[[U[0] - 40, U[1] - 70], U]]));
  return both(path(s.sh, [[[s.sh[0] - 6, s.sh[1] + 40], [U[0] - 4, U[1] - 30], U]]));
}

/** Sombras genéricas: lado izquierdo, arrugas de sisa y manga. */
function topFolds(s: TopSpec, g: TopGeo, opts: { sleeve?: boolean; side?: boolean } = {}): string {
  const U = s.under;
  const Hm = s.hem;
  let d = both(fold([U[0] - 8, U[1] + 10], [U[0] - 58, U[1] + 66], 7));
  if (opts.side !== false) {
    const Wt = s.waist;
    const pts: P[] = Wt ? [mx(U), mx(Wt), mx(Hm)] : [mx(U), mx(Hm)];
    const inner = pts.map((p, i) => add(p, [i === 0 ? 20 : 28, 0])).reverse();
    d += `M${pt(add(pts[0], [3, 14]))}${pts.slice(1).map((p) => `L${pt(add(p, [3, -3]))}`).join("")}${inner.map((p, i) => `L${pt(add(p, [0, i === 0 ? -3 : i === inner.length - 1 ? 30 : 0]))}`).join("")}Z`;
  }
  if (opts.sleeve !== false && g.O && g.I && g.dir) {
    const mO = mx(g.O);
    const mI = mx(g.I);
    const mU = mx(U);
    d += `M${pt(add(mI, [0, 0]))}L${pt(lerp(mI, mO, 0.32))}L${pt(lerp(mU, mx(s.sh), 0.3))}L${pt(mU)}Z`;
  }
  return d;
}

/** Realce en el hombro derecho. */
function topLights(s: TopSpec): string {
  return fold([s.sh[0] - 34, s.sh[1] + 26], [s.sh[0] - 52, s.sh[1] + 190], -9);
}

/** Cuello camisero: tira de cuello atrás + dos hojas con punta. */
function shirtCollar(s: TopSpec, spread = 1): { stand: string; leaves: string } {
  const N: P = [CX + s.neck.w, s.neck.y];
  const fr = s.neck.front;
  const stand = sym([CX, s.neck.y - 18], [[[CX + s.neck.w * 0.7, s.neck.y - 18], [N[0] + 2, N[1] - 10]], [[N[0] + 6, N[1] + 6]], [[CX + s.neck.w * 0.6, s.neck.y + s.neck.back - 4], [CX, s.neck.y + s.neck.back - 4]]]);
  const leaf = path(
    [CX + 2, fr - 4],
    [
      [[N[0] - 6, N[1] + 6], [N[0] + 2, N[1] - 8]],
      [[N[0] + 18 * spread, N[1] + 18]],
      [[N[0] + 28 * spread, N[1] + 32], [CX + 30 + 14 * spread, fr + 38]],
      [[CX + 18, fr + 16], [CX + 2, fr - 4]],
    ],
    true,
  );
  return { stand, leaves: both(leaf) };
}

/** Tapeta de botones: rectángulo central y botones. */
function placket(top: number, bottom: number, w = 13): { d: string; dots: P[] } {
  const d = `M${CX - w} ${top}H${CX + w}V${bottom}H${CX - w}Z`;
  const dots: P[] = [];
  const n = Math.max(2, Math.round((bottom - top) / 72));
  for (let i = 0; i < n; i++) dots.push([CX, top + 26 + (i * (bottom - top - 50)) / Math.max(1, n - 1)]);
  return { d, dots };
}

function patchPocket(x: number, y: number, w: number, h: number): { d: string; stitch: string } {
  const d = `M${x} ${y}H${x + w}V${y + h - 10}L${x + w / 2} ${y + h}L${x} ${y + h - 10}Z`;
  const stitch = `M${x + 5} ${y + 12}H${x + w - 5}M${x + 5} ${y + 5}V${y + h - 13}L${x + w / 2} ${y + h - 5}L${x + w - 5} ${y + h - 13}V${y + 5}`;
  return { d, stitch };
}

// ---------------------------------------------------------------------------
// Prendas
// ---------------------------------------------------------------------------

function basicTop(ctx: Ctx, spec: TopSpec, opts: { band?: number; cuff?: number; hemBand?: number; ribTrim?: boolean; hemOff?: number } = {}): { layers: Layer[]; g: TopGeo } {
  const g = topGeo(spec);
  const trimTex = opts.ribTrim ? ctx.defs.fabric("ribS", ctx.base) : ctx.tex;
  const layers: Layer[] = [];
  const stitches: string[] = [];
  if (!opts.cuff && g.O) stitches.push(both(acrossSleeve(g, 16)));
  if (!opts.hemBand) stitches.push(hemLine(spec, opts.hemOff ?? 16));
  layers.push({
    d: g.d,
    tex: ctx.tex,
    folds: topFolds(spec, g),
    lights: topLights(spec),
    lines: g.O || spec.raglan ? armholeLine(spec) : undefined,
    stitch: stitches.join(""),
  });
  if (opts.cuff && g.O) layers.push({ d: both(cuffD(g, opts.cuff, 0.06)), tex: trimTex });
  if (opts.hemBand) layers.push({ d: hemBand(spec, opts.hemBand), tex: trimTex });
  layers.push({ d: neckOpening(spec), fill: mix(ctx.base, INK, 0.38) });
  if (opts.band) layers.push({ d: neckBand(spec, opts.band), tex: trimTex, stitch: undefined });
  return { layers, g };
}

const GARMENTS: Record<GarmentKind, (ctx: Ctx) => Layer[]> = {
  tee(ctx) {
    const spec: TopSpec = { neck: { w: 50, y: 226, back: 10, front: 274 }, sh: [566, 256], sleeve: { len: 134, ang: 57, w: 92 }, under: [552, 356], hem: [556, 790], hemCurve: 4 };
    return basicTop(ctx, spec, { band: 14, ribTrim: true }).layers;
  },
  teeStriped(ctx) {
    const spec: TopSpec = { neck: { w: 98, y: 236, back: 6, front: 262 }, sh: [570, 262], sleeve: { len: 262, ang: 24, w: 78 }, under: [554, 362], hem: [560, 780], hemCurve: 0 };
    const { layers } = basicTop(ctx, spec, { band: 10 });
    layers[0].stitch += both(`M${spec.hem[0] - 3} ${spec.hem[1] - 46}V${spec.hem[1] - 4}`);
    return layers;
  },
  teeOversize(ctx) {
    const spec: TopSpec = { neck: { w: 56, y: 230, back: 10, front: 282 }, sh: [590, 292], sleeve: { len: 156, ang: 36, w: 124 }, under: [590, 430], hem: [592, 800], hemCurve: 0 };
    const { layers } = basicTop(ctx, spec, { band: 16, ribTrim: true, hemOff: 20 });
    layers[0].lines = both(path(spec.sh, [[[spec.sh[0] - 4, spec.sh[1] + 50], [spec.under[0] - 2, spec.under[1] - 50], spec.under]]));
    layers[0].folds += both(fold([470, 330], [440, 520], 8));
    return layers;
  },
  tank(ctx) {
    const spec: TopSpec = { neck: { w: 46, y: 232, back: 8, front: 340 }, sh: [482, 230], under: [544, 404], waist: [522, 570], hem: [540, 790], hemCurve: 4 };
    const g = topGeo(spec);
    const trim = ctx.defs.fabric("ribS", ctx.base);
    const arm = path(spec.sh, [[[spec.sh[0] + 4, spec.sh[1] + 54], [spec.under[0] - 30, spec.under[1] - 4], spec.under]]);
    const armIn = path([spec.sh[0] - 10, spec.sh[1] + 2], [[[spec.sh[0] - 7, spec.sh[1] + 66], [spec.under[0] - 34, spec.under[1] + 9], [spec.under[0] - 2, spec.under[1] + 12]]]);
    return [
      { d: g.d, tex: ctx.tex, folds: topFolds(spec, g, { sleeve: false }) + both(fold([470, 420], [450, 600], 7)), lights: fold([520, 430], [500, 640], -8), stitch: hemLine(spec, 16) + both(armIn) },
      { d: neckOpening(spec), fill: mix(ctx.base, INK, 0.38) },
      { d: neckBand(spec, 12), tex: trim, lines: both(arm) },
    ];
  },
  longsleeve(ctx) {
    const spec: TopSpec = { neck: { w: 48, y: 226, back: 10, front: 270 }, sh: [556, 254], sleeve: { len: 444, ang: 12, w: 58 }, under: [542, 352], waist: [530, 540], hem: [546, 800], hemCurve: 4 };
    return basicTop(ctx, spec, { band: 13, ribTrim: true }).layers;
  },
  turtleneck(ctx) {
    const spec: TopSpec = { neck: { w: 50, y: 238, back: 6, front: 252 }, sh: [558, 262], sleeve: { len: 440, ang: 12, w: 58 }, under: [544, 358], waist: [532, 548], hem: [548, 808], hemCurve: 4 };
    const { layers } = basicTop(ctx, spec, { cuff: 44, hemBand: 0 });
    layers.splice(layers.length - 1, 1);
    const collar = sym([CX, 150], [[[CX + 44, 150], [CX + 54, 156]], [[CX + 58, 250]], [[CX + 30, 262], [CX, 262]]]);
    return [
      ...layers,
      { d: collar, tex: ctx.tex, lines: path([CX - 56, 204], [[[CX, 214], [CX + 56, 204]]]), folds: `M${CX - 54} 206Q${CX} 216 ${CX + 56} 206L${CX + 57} 222Q${CX} 232 ${CX - 55} 222Z` },
      { d: `M${CX - 48} 156Q${CX} 146 ${CX + 48} 156Q${CX} 168 ${CX - 48} 156Z`, fill: mix(ctx.base, INK, 0.4) },
    ];
  },
  hoodie(ctx) {
    const spec: TopSpec = { neck: { w: 58, y: 240, back: 10, front: 300 }, sh: [574, 272], sleeve: { len: 436, ang: 14, w: 74 }, under: [560, 376], hem: [572, 812], hemCurve: 0 };
    const hood = sym([CX, 112], [[[CX + 76, 108], [CX + 112, 168]], [[CX + 134, 212], [CX + 126, 268]], [[CX + 60, 300]], [[CX, 300]]]);
    const { layers, g } = basicTop(ctx, spec, { cuff: 40, hemBand: 54, ribTrim: true });
    const opening = sym([CX, 150], [[[CX + 50, 150], [CX + 62, 214]], [[CX + 66, 270], [CX + 30, 304], [CX, 318]]]);
    const rim = sym([CX, 136], [[[CX + 64, 134], [CX + 78, 212]], [[CX + 82, 278], [CX + 40, 316], [CX, 334]], [[CX, 318]], [[CX + 30, 304], [CX + 66, 270], [CX + 62, 214]], [[CX + 50, 150], [CX, 150]]]);
    const pocket = sym([CX, 560], [[[CX + 74, 560]], [[CX + 108, 590], [CX + 128, 646]], [[CX + 130, 742]], [[CX, 742]]]);
    layers.splice(layers.length - 1, 1); // sin el interior del escote: lo tapa la capucha
    return [
      { d: hood, folds: fold([CX + 104, 170], [CX + 108, 262], -10), lights: fold([CX - 100, 176], [CX - 108, 250], 6) },
      ...layers,
      { d: rim, stitch: both(path([CX, 143], [[[CX + 58, 142], [CX + 70, 212]], [[CX + 74, 276], [CX + 36, 312], [CX, 327]]])) },
      { d: opening, fill: mix(ctx.base, INK, 0.42), folds: `M${CX - 50} 170Q${CX} 160 ${CX + 50} 170L${CX + 50} 200Q${CX} 186 ${CX - 50} 200Z` },
      {
        d: `M${CX - 22} 330l-6 138h8l5-138zM${CX + 22} 330l8 150h8l-6-150z`,
        fill: mix(ctx.base, "#FFFFFF", isDark(ctx.base) ? 0.25 : 0.1),
        dots: [
          [CX - 22, 330],
          [CX + 22, 330],
        ],
        dotR: 5,
      },
      { d: `M${CX - 30} 464h12v20h-12zM${CX + 30} 476h12v20h-12z`, fill: mix(ctx.base, INK, 0.5) },
      { d: pocket, tex: ctx.tex, stitch: both(path([CX + 68, 568], [[[CX + 100, 596], [CX + 120, 650]], [[CX + 122, 734]]])), folds: fold([CX + 110, 600], [CX + 118, 730], 6) + mirrorD(fold([CX + 110, 600], [CX + 118, 730], 6)) },
      { d: "M0 0", fill: ctx.base, lines: both(path([CX + 64, 300], [[[g.N[0] + 12, spec.neck.y + 6]]])) },
    ];
  },
  sweatshirt(ctx) {
    const spec: TopSpec = { neck: { w: 56, y: 236, back: 12, front: 290 }, sh: [574, 270], sleeve: { len: 432, ang: 14, w: 74 }, under: [560, 372], hem: [570, 800], hemCurve: 0, raglan: true };
    const { layers } = basicTop(ctx, spec, { band: 20, cuff: 40, hemBand: 50, ribTrim: true });
    const trim = ctx.defs.fabric("ribS", ctx.base);
    layers.push({ d: `M${CX - 9} ${spec.neck.front + 20}L${CX} ${spec.neck.front + 40}L${CX + 9} ${spec.neck.front + 20}Z`, tex: trim });
    return layers;
  },
  cardigan(ctx) {
    const spec: TopSpec = { neck: { w: 52, y: 232, back: 10, front: 452 }, sh: [568, 264], sleeve: { len: 430, ang: 13, w: 70 }, under: [554, 366], hem: [562, 812], hemCurve: 0 };
    const trim = ctx.defs.fabric("ribS", ctx.base);
    const { layers } = basicTop(ctx, spec, { cuff: 44, hemBand: 50, ribTrim: true });
    const band = vBand(spec, 22);
    const placketD = `M${CX - 14} ${spec.neck.front + 20}H${CX + 14}V${spec.hem[1]}H${CX - 14}Z`;
    const dots: P[] = [480, 548, 616, 684, 752].map((y) => [CX, y]);
    return [...layers, { d: band, tex: trim }, { d: placketD, tex: trim, dots, dotR: 7, lines: `M${CX} ${spec.neck.front + 30}V${spec.hem[1] - 2}` }];
  },
  jacket(ctx) {
    const spec: TopSpec = { neck: { w: 58, y: 236, back: 10, front: 300 }, sh: [584, 270], sleeve: { len: 420, ang: 15, w: 84 }, under: [566, 378], hem: [574, 780], hemCurve: 0 };
    const { layers, g } = basicTop(ctx, spec, { cuff: 36, hemBand: 42 });
    const sherpa = "#EEE6D6";
    const collar = sym([CX, 214], [[[CX + 70, 210], [CX + 130, 256]], [[CX + 70, 372]], [[CX + 38, 340], [CX + 6, 300]]]);
    const neckIn = sym([CX, 238], [[[CX + 40, 236], [CX + 54, 248]], [[CX + 54, 276], [CX + 22, 300], [CX, 304]]]);
    const pk = { x: 446, y: 410, w: 86 };
    const flap = both(`M${pk.x} ${pk.y}H${pk.x + pk.w}V${pk.y + 34}L${pk.x + pk.w / 2} ${pk.y + 50}L${pk.x} ${pk.y + 34}Z`);
    layers[0].lines = (layers[0].lines ?? "") + both(`M${pk.x + 6} ${pk.y + 50}V${spec.hem[1] - 44}`) + `M${CX + 16} ${spec.neck.front}V${spec.hem[1]}`;
    layers[0].stitch = (layers[0].stitch ?? "") + both(`M${pk.x - 4} ${pk.y + 96}H${pk.x + pk.w + 4}`) + `M${CX + 24} ${spec.neck.front + 30}V${spec.hem[1] - 46}`;
    const cuffBtn = g.O && g.I ? [lerp(add(g.O, g.dir!, -18), add(g.I, g.dir!, -18), 0.5)] : [];
    return [
      ...layers,
      { d: flap, tex: ctx.tex, dots: [[pk.x + pk.w / 2, pk.y + 32], mx([pk.x + pk.w / 2, pk.y + 32])], dotR: 5.5, stitch: both(`M${pk.x + 6} ${pk.y + 8}H${pk.x + pk.w - 6}`) },
      { d: "M0 0", dots: [[CX + 10, 420], [CX + 10, 520], [CX + 10, 620], [CX + 10, 760], ...cuffBtn, ...cuffBtn.map(mx)], dotR: 7 },
      { d: neckIn, fill: mix(ctx.base, INK, 0.4) },
      { d: collar, fill: sherpa, tex: ctx.defs.fabric("sherpa", sherpa), folds: both(fold([CX + 66, 300], [CX + 108, 262], 6)) },
    ];
  },
  puffer(ctx) {
    const spec: TopSpec = { neck: { w: 60, y: 236, back: 8, front: 256 }, sh: [584, 276], sleeve: { len: 396, ang: 19, w: 104 }, under: [566, 384], hem: [578, 676], hemCurve: 0, quilt: { body: 4, sleeve: 5 } };
    const g = topGeo(spec);
    const U = spec.under;
    const Hm = spec.hem;
    let quilt = "";
    for (let i = 1; i < 4; i++) {
      const p = lerp(U, Hm, i / 4);
      quilt += `M${pt(mx(p))}Q${CX} ${f(p[1] + 12)} ${pt(p)}`;
    }
    quilt += `M${pt(mx([U[0] - 22, U[1] - 64]))}Q${CX} ${U[1] - 50} ${U[0] - 22} ${U[1] - 64}`;
    if (g.O && g.I) {
      for (let i = 1; i < 5; i++) {
        const a = lerp(spec.sh, g.O, i / 5);
        const b = lerp(U, g.I, i / 5);
        quilt += both(`M${pt(a)}Q${pt(add(lerp(a, b, 0.5), [0, 8]))} ${pt(b)}`);
      }
    }
    const shine = both(fold([CX + 70, 400], [CX + 150, 404], 6) + fold([CX + 70, 470], [CX + 150, 474], 6) + fold([CX + 70, 540], [CX + 150, 544], 6));
    const collar = sym([CX, 176], [[[CX + 60, 176], [CX + 70, 186]], [[CX + 74, 262]], [[CX + 40, 270], [CX, 270]]]);
    const cuff = cuffD(g, 26, 0.12);
    return [
      { d: g.d, folds: topFolds(spec, g, { side: false }), lights: shine, lines: quilt + armholeLine(spec), stitch: `M${CX + 8} 270V${Hm[1] - 4}` },
      { d: both(cuff), fill: mix(ctx.base, INK, 0.25), tex: ctx.defs.fabric("ribS", mix(ctx.base, INK, 0.25)) },
      { d: collar, lines: path([CX - 72, 222], [[[CX, 230], [CX + 72, 222]]]), folds: `M${CX - 70} 186Q${CX} 176 ${CX + 70} 186V198Q${CX} 186 ${CX - 70} 198Z` },
      { d: `M${CX - 64} 182Q${CX} 170 ${CX + 64} 182Q${CX} 194 ${CX - 64} 182Z`, fill: mix(ctx.base, INK, 0.4) },
      { d: `M${CX - 5} 180H${CX + 5}V${Hm[1]}H${CX - 5}Z`, fill: mix(ctx.base, INK, 0.3), lines: `M${CX} 186V${Hm[1] - 2}` },
      { d: `M${CX - 5} 196h10v26h-10z`, fill: "#D9D6E0" },
    ];
  },
  coat(ctx) {
    const spec: TopSpec = { neck: { w: 56, y: 230, back: 10, front: 470 }, sh: [578, 262], sleeve: { len: 446, ang: 11, w: 80 }, under: [560, 372], waist: [548, 560], hem: [594, 916], hemCurve: 0 };
    const g = topGeo(spec);
    const lapel = path([CX + 54, 236], [[[CX + 80, 300]], [[CX + 66, 312]], [[CX + 116, 326]], [[CX + 60, 410], [CX + 10, 478]], [[CX + 30, 360], [CX + 54, 236]]], true);
    const collar = sym([CX, 212], [[[CX + 44, 210], [CX + 60, 222]], [[CX + 84, 298]], [[CX + 54, 240]], [[CX + 36, 232], [CX, 232]]]);
    const neckIn = sym([CX, 232], [[[CX + 36, 232], [CX + 54, 240]], [[CX + 30, 360], [CX + 2, 470]]]);
    const flap = both(`M454 646H548V676H454Z`);
    const cuffLine = g.O ? both(acrossSleeve(g, 70)) : "";
    return [
      {
        d: g.d,
        tex: ctx.tex,
        folds: topFolds(spec, g) + both(fold([470, 700], [480, 900], 9)),
        lights: topLights(spec),
        lines: armholeLine(spec) + `M${CX + 18} 478V${spec.hem[1] - 2}` + cuffLine + both("M500 380Q510 470 500 560"),
        stitch: hemLine(spec, 18),
      },
      { d: neckIn, fill: mix(ctx.base, INK, 0.38) },
      { d: collar, tex: ctx.tex },
      { d: both(lapel), tex: ctx.tex, folds: both(fold([CX + 100, 334], [CX + 24, 452], 5)), stitch: both(path([CX + 70, 304], [[[CX + 104, 322]], [[CX + 56, 410]]])) },
      { d: flap, tex: ctx.tex, stitch: both("M460 670H542") },
      { d: "M0 0", dots: [[CX + 36, 540], [CX + 36, 640], [CX + 36, 740]], dotR: 8 },
    ];
  },
  pantsStraight(ctx) {
    return pants(ctx, { waistY: 236, waistW: 132, hipY: 350, hipW: 150, crotchY: 466, hemY: 904, outer: 142, inner: 28, style: "jean" });
  },
  pantsCord(ctx) {
    return pants(ctx, { waistY: 236, waistW: 128, hipY: 350, hipW: 150, crotchY: 470, hemY: 904, outer: 150, inner: 26, style: "five" });
  },
  pantsWide(ctx) {
    const n = norm(ctx.name);
    const style = /lino/.test(n) ? "tie" : /palazzo|fibrana/.test(n) ? "plain" : "pleat";
    return pants(ctx, { waistY: 230, waistW: 124, hipY: 360, hipW: 160, crotchY: 482, hemY: 910, outer: 232, inner: 10, style });
  },
  jogger(ctx) {
    return pants(ctx, { waistY: 236, waistW: 136, hipY: 350, hipW: 158, crotchY: 476, hemY: 884, outer: 112, inner: 44, style: "jogger" });
  },
  pantsTailored(ctx) {
    return pants(ctx, { waistY: 226, waistW: 128, hipY: 350, hipW: 154, crotchY: 466, hemY: 908, outer: 132, inner: 36, style: "tailored" });
  },
  dressShirt(ctx) {
    const spec: TopSpec = { neck: { w: 46, y: 230, back: 8, front: 290 }, sh: [552, 258], sleeve: { len: 150, ang: 42, w: 78 }, under: [540, 360], waist: [512, 520], hem: [590, 880], hemCurve: 0 };
    const { layers, g } = basicTop(ctx, spec, { cuff: 26 });
    const { stand, leaves } = shirtCollar(spec, 0.9);
    const pl = placket(spec.neck.front, spec.hem[1]);
    const belt = sym([CX, 506], [[[CX + 116, 504]], [[CX + 116, 530]], [[CX, 532]]]);
    layers[0].folds += both(fold([470, 560], [520, 870], 12)) + fold([420, 560], [430, 870], 6);
    layers[0].lines += both(path([CX + 20, 560], [[[CX + 60, 860]]]));
    layers.splice(layers.length - 1, 1);
    return [
      ...layers,
      { d: neckOpening(spec), fill: mix(ctx.base, INK, 0.38) },
      { d: stand, tex: ctx.tex },
      { d: pl.d, tex: ctx.tex, dots: pl.dots.filter((p) => p[1] < 496 || p[1] > 548), dotR: 5 },
      { d: leaves, tex: ctx.tex },
      { d: belt, tex: ctx.tex, stitch: `M${CX - 112} 512H${CX + 112}M${CX - 112} 525H${CX + 112}` },
      { d: `M${CX + 30} 528C${CX + 36} 600 ${CX + 30} 660 ${CX + 44} 700L${CX + 62} 696C${CX + 50} 650 ${CX + 56} 600 ${CX + 50} 528ZM${CX + 50} 528C${CX + 70} 590 ${CX + 82} 630 ${CX + 96} 668L${CX + 112} 658C${CX + 96} 620 ${CX + 82} 580 ${CX + 66} 526Z`, tex: ctx.tex },
      { d: `M${CX + 26} 500C${CX + 4} 486 ${CX + 2} 540 ${CX + 30} 530C${CX + 30} 520 ${CX + 30} 510 ${CX + 26} 500ZM${CX + 50} 500C${CX + 80} 484 ${CX + 82} 544 ${CX + 50} 532Z`, tex: ctx.tex },
      { d: `M${CX + 26} 502h26v28h-26z`, tex: ctx.tex },
      ...(g.O ? [] : []),
    ];
  },
  dressMidi(ctx) {
    const spec: TopSpec = { neck: { w: 46, y: 232, back: 8, front: 340 }, sh: [538, 258], sleeve: { len: 118, ang: 60, w: 104, puff: 10 }, under: [530, 350], waist: [504, 506], hem: [626, 900], hemCurve: 8 };
    const g = topGeo(spec);
    const frill = g.O && g.I ? both(path(g.O, [[add(lerp(g.O, g.I, 0.25), [10, 10]), lerp(g.O, g.I, 0.5)], [add(lerp(g.O, g.I, 0.75), [4, 14]), g.I]])) : "";
    return [
      {
        d: g.d,
        tex: ctx.tex,
        folds: topFolds(spec, g, { side: false }) + both(fold([440, 530], [470, 900], 14)) + fold([400, 540], [404, 906], 8) + both(fold([540, 560], [600, 890], 10)),
        lights: fold([500, 560], [540, 880], -10),
        lines: armholeLine(spec) + `M${pt(mx(spec.waist!))}Q${CX} ${spec.waist![1] + 8} ${pt(spec.waist!)}` + frill,
        stitch: hemLine(spec, 14) + both(path([CX + 4, 336], [[[CX + 46, 236]]])),
      },
      { d: neckOpening(spec), fill: mix(ctx.base, INK, 0.45) },
      { d: vBand(spec, 9), tex: ctx.tex },
    ];
  },
  dressShort(ctx) {
    const spec: TopSpec = { neck: { w: 46, y: 228, back: 10, front: 272 }, sh: [550, 256], sleeve: { len: 420, ang: 13, w: 54 }, under: [536, 352], waist: [508, 506], hem: [586, 832], hemCurve: 8 };
    const { layers } = basicTop(ctx, spec, { band: 14 });
    layers[0].folds += both(fold([450, 540], [500, 836], 11)) + fold([400, 540], [404, 842], 6);
    layers[0].lines += `M${pt(mx(spec.waist!))}Q${CX} ${spec.waist![1] + 8} ${pt(spec.waist!)}`;
    return layers;
  },
  dressSlip(ctx) {
    const straps = both(`M466 206h7l3 ${116}h-7z`);
    const body = sym([CX, 372], [[[CX + 40, 336], [CX + 72, 314]], [[CX + 108, 318], [CX + 130, 368]], [[CX + 122, 440], [CX + 112, 520]], [[CX + 150, 700], [CX + 220, 912]], [[CX + 120, 924], [CX, 924]]]);
    return [
      { d: straps },
      {
        d: body,
        tex: ctx.tex,
        folds: both(fold([450, 560], [500, 916], 16)) + fold([400, 560], [396, 920], 9) + both(fold([CX + 112, 540], [CX + 190, 900], 10)) + both(fold([CX + 70, 330], [CX + 40, 372], 5)),
        lights: fold([480, 540], [560, 900], -12) + mirrorD(fold([CX + 40, 600], [CX + 90, 880], 6)),
        lines: both(path([CX, 410], [[[CX + 50, 418], [CX + 120, 404]]])),
        stitch: both(path([CX + 4, 362], [[[CX + 40, 332], [CX + 70, 322]]])) + sym([CX, 914], [[[CX + 120, 914], [CX + 214, 902]]]).replace(/Z$/, ""),
      },
    ];
  },
  dressKnit(ctx) {
    const spec: TopSpec = { neck: { w: 44, y: 232, back: 6, front: 246 }, sh: [548, 260], sleeve: { len: 448, ang: 11, w: 52 }, under: [534, 356], waist: [498, 520], hem: [530, 908], hemCurve: 4 };
    const { layers } = basicTop(ctx, spec, { cuff: 48 });
    layers.splice(layers.length - 1, 1);
    const collar = sym([CX, 186], [[[CX + 40, 186], [CX + 46, 190]], [[CX + 48, 244]], [[CX + 24, 252], [CX, 252]]]);
    layers[0].stitch += `M${CX + 70} ${spec.hem[1] - 2}V${spec.hem[1] - 110}`;
    layers[0].folds += both(fold([450, 560], [470, 880], 8));
    return [...layers, { d: collar, tex: ctx.tex }, { d: `M${CX - 42} 192Q${CX} 182 ${CX + 42} 192Q${CX} 202 ${CX - 42} 192Z`, fill: mix(ctx.base, INK, 0.4) }];
  },
  shirtLoose(ctx) {
    const spec: TopSpec = { neck: { w: 50, y: 232, back: 10, front: 284 }, sh: [594, 290], sleeve: { len: 400, ang: 15, w: 86 }, under: [590, 424], hem: [596, 830], hemCurve: 34 };
    const { layers } = basicTop(ctx, spec, { cuff: 38, hemOff: 12 });
    layers[0].lines = both(path(spec.sh, [[[spec.sh[0] - 4, spec.sh[1] + 50], [spec.under[0] - 2, spec.under[1] - 50], spec.under]]));
    layers.splice(layers.length - 1, 1);
    const { stand, leaves } = shirtCollar(spec, 1.1);
    const pl = placket(spec.neck.front, spec.hem[1] + 34);
    const pocket = patchPocket(440, 380, 74, 84);
    return [
      ...layers,
      { d: neckOpening(spec), fill: mix(ctx.base, INK, 0.38) },
      { d: stand, tex: ctx.tex },
      { d: pocket.d, tex: ctx.tex, stitch: pocket.stitch },
      { d: pl.d, tex: ctx.tex, dots: pl.dots, dotR: 5 },
      { d: leaves, tex: ctx.tex },
    ];
  },
  shirtClassic(ctx) {
    const spec: TopSpec = { neck: { w: 46, y: 230, back: 8, front: 278 }, sh: [558, 256], sleeve: { len: 438, ang: 12, w: 62 }, under: [546, 354], waist: [532, 540], hem: [550, 808], hemCurve: 26 };
    const { layers, g } = basicTop(ctx, spec, { cuff: 44, hemOff: 10 });
    layers.splice(layers.length - 1, 1);
    const { stand, leaves } = shirtCollar(spec, 0.8);
    const pl = placket(spec.neck.front, spec.hem[1] + 26);
    const cuffBtn = g.O && g.I && g.dir ? [lerp(add(g.O, g.dir, -22), add(g.I, g.dir, -22), 0.72)] : [];
    layers[0].lines += both(path([CX + 70, 400], [[[CX + 76, 600]]]));
    return [
      ...layers,
      { d: neckOpening(spec), fill: mix(ctx.base, INK, 0.38) },
      { d: stand, tex: ctx.tex },
      { d: pl.d, tex: ctx.tex, dots: [...pl.dots, ...cuffBtn, ...cuffBtn.map(mx)], dotR: 5 },
      { d: leaves, tex: ctx.tex },
    ];
  },
  blouseRuffle(ctx) {
    const spec: TopSpec = { neck: { w: 52, y: 232, back: 8, front: 274 }, sh: [560, 258], sleeve: { len: 380, ang: 17, w: 84 }, under: [546, 356], hem: [562, 770], hemCurve: 6 };
    const { layers, g } = basicTop(ctx, spec, { band: 8 });
    // Volado del canesú: borde inferior ondulado.
    const yokeSegs: Seg[] = [[[CX + 26, 274], [CX + 52, 232]], [[CX + 120, 262]]];
    const scal = (a: P, b: P, n: number, amt: number): Seg[] => bulge(a, b, n, amt);
    yokeSegs.push(...scal([CX + 120, 262], [CX, 372], 5, 12));
    const yoke = sym([CX, 274], yokeSegs);
    let gathers = "";
    for (let i = 1; i < 5; i++) {
      const p = lerp([CX + 120, 262], [CX, 372], i / 5);
      gathers += both(path(lerp([CX + 52, 236], [CX, 280], i / 5), [[add(p, [-4, -10])]]));
    }
    let ruffle = "";
    if (g.O && g.I && g.dir) {
      const o2 = add(g.O, g.dir, 66);
      const i2 = add(g.I, g.dir, 66);
      ruffle = path(g.O, [[add(o2, [26, -4])], ...bulge(add(o2, [26, -4]), add(i2, [-30, 6]), 4, 10), [g.I]], true);
    }
    const yokeLayer: Layer = { d: yoke, tex: ctx.tex, lines: gathers, folds: both(fold([CX + 90, 300], [CX + 60, 340], 5)) };
    layers.splice(layers.length - 1, 1);
    return [...layers, { d: both(ruffle), tex: ctx.tex, lines: both(g.O && g.I ? `M${pt(g.O)}L${pt(g.I)}` : "") }, yokeLayer, { d: neckBand(spec, 8), tex: ctx.tex }];
  },
  blouseBow(ctx) {
    const sheer = /gasa|tul|voile/.test(norm(ctx.name));
    const spec: TopSpec = { neck: { w: 46, y: 230, back: 8, front: 274 }, sh: [558, 258], sleeve: { len: 432, ang: 13, w: 70 }, under: [546, 356], hem: [554, 790], hemCurve: 10, separateSleeves: sheer };
    const g = topGeo(spec);
    const cuff = cuffD(g, 40, 0.06);
    const layers: Layer[] = [];
    const sleeveLayer: Layer | null = g.sleeveD ? { d: both(g.sleeveD), opacity: 0.8, folds: both(fold(lerp(spec.under, g.I!, 0.2), lerp(spec.under, g.I!, 0.8), 8)), stitch: undefined } : null;
    layers.push({ d: g.d, tex: ctx.tex, folds: topFolds(spec, g, { sleeve: !sheer }), lights: topLights(spec), lines: g.sleeveD ? undefined : armholeLine(spec), stitch: hemLine(spec, 14) });
    if (sleeveLayer) layers.push(sleeveLayer);
    layers.push({ d: both(cuff), dots: g.O && g.I && g.dir ? [lerp(add(g.O, g.dir, -20), add(g.I, g.dir, -20), 0.72), mx(lerp(add(g.O, g.dir, -20), add(g.I, g.dir, -20), 0.72))] : [], dotR: 4.5 });
    layers.push({ d: neckOpening(spec), fill: mix(ctx.base, INK, 0.38) });
    layers.push({ d: neckBand(spec, 12) });
    const tails = `M${CX + 6} 290C${CX + 16} 360 ${CX + 30} 420 ${CX + 48} 486L${CX + 26} 494C${CX + 14} 430 ${CX + 4} 370 ${CX - 2} 296ZM${CX - 6} 290C${CX - 14} 350 ${CX - 30} 400 ${CX - 50} 458L${CX - 30} 468C${CX - 12} 410 ${CX - 2} 360 ${CX + 2} 296Z`;
    const loops = both(`M${CX + 6} 284C${CX + 40} 250 ${CX + 82} 258 ${CX + 78} 288C${CX + 74} 316 ${CX + 38} 310 ${CX + 6} 294Z`);
    layers.push({ d: tails, folds: fold([CX + 12, 310], [CX + 40, 480], 4) });
    layers.push({ d: loops, folds: both(fold([CX + 14, 288], [CX + 66, 290], 5)) });
    layers.push({ d: `M${CX - 14} 276h28v24h-28z`, folds: `M${CX - 14} 290h28v10h-28z` });
    return layers;
  },
  scarfSilk(ctx) {
    const s = 470;
    const x0 = CX - s / 2;
    const y0 = 220;
    const x1 = x0 + s;
    const y1 = y0 + s;
    const c = 120;
    const tf = `rotate(-7 ${CX} ${y0 + s / 2})`;
    const border = mix(ctx.base, INK, 0.38);
    const sq = `M${x0} ${y0}H${x1}V${y1 - c}L${x1 - c} ${y1}H${x0}Z`;
    const inner = `M${x0 + 26} ${y0 + 26}H${x1 - 26}V${y1 - c - 8}M${x1 - c - 8} ${y1 - 26}H${x0 + 26}Z`;
    const ring = `${sq}M${x0 + 20} ${y0 + 20}V${y1 - 20}H${x1 - c - 12}L${x1 - 20} ${y1 - c - 12}V${y0 + 20}Z`;
    const flap = `M${x1} ${y1 - c}L${x1 - c} ${y1}L${x1 - c} ${y1 - c}Z`;
    return [
      { d: sq, tex: ctx.tex, tf, lights: `M${x0 + 40} ${y0 + 40}L${x0 + 200} ${y0 + 40}L${x0 + 40} ${y0 + 200}Z`, stitch: `M${x0 + 8} ${y0 + 8}H${x1 - 8}V${y1 - c - 4}M${x1 - c - 4} ${y1 - 8}H${x0 + 8}Z` },
      { d: ring, fill: border, tf, stitch: inner },
      { d: flap, fill: mix(ctx.base, "#FFFFFF", 0.35), tex: ctx.tex, tf, folds: `M${x1 - c} ${y1}L${x1 - c} ${y1 - c}L${x1 - c + 30} ${y1 - c}L${x1 - c + 6} ${y1 - 6}Z` },
    ];
  },
  scarfKnit(ctx) {
    const back = `M${CX + 2} 236Q${CX + 56} 214 ${CX + 112} 240V836H${CX + 2}Z`;
    const front = `M${CX - 112} 260Q${CX - 108} 196 ${CX - 20} 196Q${CX + 50} 198 ${CX + 72} 236Q${CX + 10} 238 ${CX - 4} 262V800H${CX - 112}Z`;
    const fringe = (x0: number, x1: number, y: number) => {
      let d = "";
      for (let x = x0 + 6; x < x1 - 2; x += 9) d += `M${x} ${y}l${(x % 3) - 1} 44`;
      return d;
    };
    return [
      { d: back, tex: ctx.tex, folds: `M${CX + 2} 240H${CX + 30}V836H${CX + 2}Z`, lines: `M${CX + 2} 790H${CX + 112}` + fringe(CX + 2, CX + 112, 838) },
      { d: front, tex: ctx.tex, folds: fold([CX - 20, 205], [CX + 60, 232], 8) + `M${CX - 112} 300H${CX - 90}V800H${CX - 112}Z`, lights: fold([CX - 60, 320], [CX - 64, 760], -8), lines: `M${CX - 112} 754H${CX - 4}` + fringe(CX - 112, CX - 4, 802) },
      { d: `M${CX + 4} 838h${108}v4h-108zM${CX - 110} 802h${106}v4h-106z`, fill: ctx.base },
    ];
  },
  socks(ctx) {
    const dark = isDark(ctx.base) || luminance(ctx.base) < 0.12;
    const colors = dark ? [ctx.base, "#1F2A44", "#6B1E2A"] : [ctx.base, "#C2A98A", "#A9C6DD"];
    const sock = "M0 0H78V214Q80 236 108 240H170Q204 242 204 274Q204 306 170 306H46Q0 306 0 256Z";
    const out: Layer[] = [];
    const placements: [number, number, number][] = [
      [214, 268, -9],
      [348, 236, 0],
      [478, 262, 9],
    ];
    placements.forEach(([x, y, r], i) => {
      const fill = colors[i];
      const tf = `translate(${x} ${y}) rotate(${r}) scale(1.22)`;
      const tone = mix(fill, isDark(fill) ? "#FFFFFF" : INK, isDark(fill) ? 0.14 : 0.16);
      out.push({ d: sock, fill, tf, tex: i === 0 && /surtido claro/i.test(ctx.name) ? null : ctx.defs.fabric("knit", fill), folds: "M0 214Q0 300 52 306L54 270Q26 262 22 214Z" });
      out.push({ d: "M0 0H78V44H0Z", fill, tf, tex: ctx.defs.fabric("ribS", fill) });
      out.push({ d: "M150 241Q204 242 204 274Q204 306 150 306Q164 274 150 241ZM0 222Q2 300 50 306Q30 270 34 222Z", fill: tone, tf, stitch: "M0 52H78" });
    });
    return out;
  },
};

interface PantsSpec {
  waistY: number;
  waistW: number;
  hipY: number;
  hipW: number;
  crotchY: number;
  hemY: number;
  outer: number;
  inner: number;
  style: "jean" | "five" | "tie" | "plain" | "pleat" | "jogger" | "tailored";
}

function pants(ctx: Ctx, s: PantsSpec): Layer[] {
  const wb = s.style === "jogger" ? 50 : s.style === "tailored" ? 40 : 34;
  const cuff = s.style === "jogger" ? 54 : 0;
  const legMid = CX + (s.outer + s.inner) / 2;
  const segs: Seg[] = [
    [[CX + s.waistW, s.waistY]],
    [[CX + s.waistW + 4, s.waistY + (s.hipY - s.waistY) * 0.5], [CX + s.hipW, s.hipY - 40], [CX + s.hipW, s.hipY]],
  ];
  if (cuff) {
    segs.push([[CX + s.hipW, s.hipY + 200], [CX + s.outer + 22, s.hemY - cuff - 60], [CX + s.outer + 14, s.hemY - cuff]]);
    segs.push([[CX + s.outer, s.hemY - cuff + 6]], [[CX + s.outer, s.hemY]], [[CX + s.inner, s.hemY]], [[CX + s.inner, s.hemY - cuff + 6]], [[CX + s.inner - 12, s.hemY - cuff]]);
  } else {
    segs.push([[CX + s.hipW + 2, s.hipY + 160], [CX + s.outer, s.hemY - 200], [CX + s.outer, s.hemY]]);
    segs.push([[CX + (s.outer + s.inner) / 2, s.hemY + 6], [CX + s.inner, s.hemY]]);
  }
  segs.push([[CX + s.inner + 2, s.crotchY + 200], [CX + 18, s.crotchY + 30], [CX + 6, s.crotchY + 6]], [[CX, s.crotchY]]);
  const d = sym([CX, s.waistY], segs);
  const band = sym([CX, s.waistY], [[[CX + s.waistW, s.waistY]], [[CX + s.waistW + 2, s.waistY + wb]], [[CX, s.waistY + wb]]]);
  const layers: Layer[] = [];
  let folds = both(fold([CX + 20, s.crotchY - 20], [CX + 60, s.crotchY + 60], 6));
  let lines = "";
  let stitch = "";
  const lights = fold([legMid + 20, s.hipY + 40], [legMid + 30, s.hemY - 60], -9);
  const sideShade = `M${pt(mx([CX + s.hipW - 3, s.hipY + 10]))}C${pt(mx([CX + s.hipW - 2, s.hipY + 160]))} ${pt(mx([CX + s.outer - 2, s.hemY - 200]))} ${pt(mx([CX + s.outer - 2, s.hemY - (cuff || 4)]))}L${pt(mx([CX + s.outer - 34, s.hemY - (cuff || 4)]))}C${pt(mx([CX + s.outer - 30, s.hemY - 200]))} ${pt(mx([CX + s.hipW - 28, s.hipY + 160]))} ${pt(mx([CX + s.hipW - 30, s.hipY + 30]))}Z`;
  folds += sideShade;
  if (s.style === "jean" || s.style === "five") {
    lines += `M${CX} ${s.waistY + wb}V${s.crotchY - 6}`;
    stitch += `M${CX - 26} ${s.waistY + wb}V${s.crotchY - 50}Q${CX - 24} ${s.crotchY - 18} ${CX} ${s.crotchY - 10}`;
    if (s.style === "five") {
      lines += both(path([CX + s.waistW - 70, s.waistY + wb], [[[CX + s.waistW - 60, s.waistY + 110], [CX + s.hipW - 2, s.waistY + 104]]]));
      stitch += both(path([CX + s.waistW - 60, s.waistY + wb], [[[CX + s.waistW - 52, s.waistY + 100], [CX + s.hipW - 2, s.waistY + 96]]]));
    } else {
      lines += both(`M${CX + s.waistW - 56} ${s.waistY + wb}L${CX + s.hipW - 1} ${s.waistY + 118}`);
      lines += both(`M${legMid} ${s.hipY + 30}V${s.hemY - 2}`);
    }
    stitch += hemSt();
    folds += both(fold([legMid - 30, s.hemY - 140], [legMid + 40, s.hemY - 120], 6));
  }
  if (s.style === "tailored") {
    lines += `M${CX} ${s.waistY + wb}V${s.crotchY - 6}`;
    lines += both(`M${CX + 44} ${s.waistY + wb}l4 74M${CX + 76} ${s.waistY + wb}l3 56`);
    lines += both(`M${CX + s.waistW - 40} ${s.waistY + wb}L${CX + s.hipW - 1} ${s.waistY + 130}`);
    lines += both(`M${CX + 48} ${s.waistY + wb + 74}C${legMid - 4} ${s.hipY + 140} ${legMid} ${s.crotchY + 100} ${legMid} ${s.hemY - 2}`);
    stitch += `M${CX - 26} ${s.waistY + wb}V${s.crotchY - 50}Q${CX - 24} ${s.crotchY - 18} ${CX} ${s.crotchY - 10}` + hemSt(14);
    folds += both(fold([CX + 50, s.waistY + wb + 4], [CX + 60, s.waistY + wb + 110], 6));
  }
  if (s.style === "pleat" || s.style === "plain" || s.style === "tie") {
    lines += `M${CX} ${s.waistY + wb}V${s.crotchY - 6}`;
    if (s.style === "pleat") lines += both(`M${CX + 50} ${s.waistY + wb}l6 90M${CX + 84} ${s.waistY + wb}l5 64`);
    lines += both(`M${CX + s.waistW - 30} ${s.waistY + wb}L${CX + s.hipW - 2} ${s.waistY + 140}`);
    folds += both(fold([CX + 70, s.crotchY - 40], [CX + 110, s.hemY - 6], 14) + fold([CX + 160, s.hipY + 60], [CX + 200, s.hemY - 6], 10));
    stitch += hemSt(14);
  }
  if (s.style === "jogger") {
    lines += `M${CX} ${s.waistY + wb}V${s.crotchY - 6}`;
    lines += both(`M${CX + s.waistW - 30} ${s.waistY + wb}Q${CX + s.waistW - 4} ${s.waistY + 100} ${CX + s.hipW - 2} ${s.waistY + 140}`);
    folds += both(fold([legMid - 30, s.hemY - cuff - 40], [legMid + 34, s.hemY - cuff - 70], 7) + fold([legMid - 36, s.hemY - cuff - 110], [legMid + 30, s.hemY - cuff - 140], 6));
  }
  layers.push({ d, tex: ctx.tex, folds, lights, lines, stitch });
  const trim = ctx.defs.fabric("ribS", ctx.base);
  if (s.style === "jogger" || s.style === "tie") {
    let gathers = "";
    for (let x = CX - s.waistW + 10; x < CX + s.waistW; x += 16) gathers += `M${x} ${s.waistY + 6}v${wb - 12}`;
    layers.push({ d: band, tex: s.style === "jogger" ? trim : ctx.tex, lines: s.style === "tie" ? gathers : undefined, stitch: `M${CX - s.waistW + 4} ${s.waistY + 7}H${CX + s.waistW - 4}M${CX - s.waistW + 4} ${s.waistY + wb - 7}H${CX + s.waistW - 4}` });
    layers.push({ d: `M${CX - 18} ${s.waistY + 22}c-6 40-14 80-26 120h9c12-40 20-80 24-118zM${CX + 18} ${s.waistY + 22}c4 44 10 90 22 130h9c-10-40-16-84-20-128z`, fill: mix(ctx.base, "#FFFFFF", isDark(ctx.base) ? 0.3 : 0.45), dots: [[CX - 16, s.waistY + 20], [CX + 16, s.waistY + 20]], dotR: 4 });
    if (cuff) layers.push({ d: both(`M${CX + s.inner} ${s.hemY - cuff + 6}H${CX + s.outer}V${s.hemY}H${CX + s.inner}Z`), tex: trim });
  } else {
    const loops = [CX - s.waistW + 20, CX - 60, CX + 60, CX + s.waistW - 20];
    layers.push({ d: band, tex: ctx.tex, stitch: `M${CX - s.waistW + 4} ${s.waistY + 6}H${CX + s.waistW - 4}M${CX - s.waistW + 4} ${s.waistY + wb - 6}H${CX + s.waistW - 4}`, lines: s.style === "tailored" ? `M${CX + 22} ${s.waistY}V${s.waistY + wb}` : undefined, dots: [[CX + (s.style === "tailored" ? 10 : 0), s.waistY + wb / 2]], dotR: 6.5 });
    if (s.style !== "plain") layers.push({ d: loops.map((x) => `M${x - 5} ${s.waistY - 4}h10v${wb + 10}h-10z`).join(""), tex: ctx.tex });
  }
  return layers;

  function hemSt(off = 18): string {
    return both(`M${CX + s.inner + 3} ${s.hemY - off + 3}Q${CX + (s.outer + s.inner) / 2} ${s.hemY - off + 8} ${CX + s.outer - 3} ${s.hemY - off}`);
  }
}

// ---------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------

const BACKGROUNDS = ["#E9E7F0", "#E7E5EF", "#EBE9F2", "#E6E4EE"];

function scene(seed: string, caption: string, garment: string, defs: string): string {
  const h = hash(seed);
  const phase = h % 8;
  const bg = BACKGROUNDS[(h >>> 3) % BACKGROUNDS.length];
  const mcx = CX;
  const mcy = 470;
  const r = 296;
  const moonDark = mix(bg, INK, 0.07);
  const moonLit = mix(bg, "#FFFFFF", 0.55);
  const orbitR = 352;
  const a = (((h >>> 6) % 360) * Math.PI) / 180;
  const sat: P = [mcx + Math.cos(a) * orbitR, mcy + Math.sin(a) * orbitR * 0.999];
  // Fila de fases arriba: la de este producto, marcada.
  let strip = "";
  for (let i = 0; i < 8; i++) {
    const x = CX - 7 * 13 + i * 26;
    const y = 72;
    const rr = i === phase ? 7.5 : 5.5;
    const lit = litPath(x, y, rr, i);
    strip += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${INK}" fill-opacity="${i === phase ? 0.85 : 0.4}"/>`;
    if (lit) strip += `<path d="${lit}" fill="${moonLit}"/>`;
    strip += `<circle cx="${x}" cy="${y}" r="${rr}" fill="none" stroke="${INK}" stroke-opacity="${i === phase ? 0.85 : 0.4}" stroke-width="1.2"/>`;
  }
  const lit = litPath(mcx, mcy, r, phase);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(caption)}">`,
    `<defs><pattern id="grain" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="2" r=".7" fill="${INK}" fill-opacity=".06"/><circle cx="5" cy="5.5" r=".6" fill="#FFFFFF" fill-opacity=".35"/></pattern>${defs}</defs>`,
    `<rect width="${W}" height="${H}" fill="${bg}"/>`,
    `<circle cx="${mcx}" cy="${mcy}" r="${orbitR}" fill="none" stroke="${INK}" stroke-opacity=".2" stroke-width="1.2"/>`,
    `<ellipse cx="${mcx}" cy="${mcy}" rx="${orbitR + 34}" ry="${orbitR - 120}" transform="rotate(-18 ${mcx} ${mcy})" fill="none" stroke="${INK}" stroke-opacity=".1" stroke-width="1.2"/>`,
    `<circle cx="${mcx}" cy="${mcy}" r="${r}" fill="${moonDark}"/>`,
    lit ? `<path d="${lit}" fill="${moonLit}"/>` : "",
    `<circle cx="${mcx}" cy="${mcy}" r="${r}" fill="none" stroke="${INK}" stroke-opacity=".12" stroke-width="1.2"/>`,
    `<circle cx="${f(sat[0])}" cy="${f(sat[1])}" r="6" fill="${INK}" fill-opacity=".55"/>`,
    `<rect width="${W}" height="${H}" fill="url(#grain)"/>`,
    strip,
    garment,
    `<text x="${CX}" y="958" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="19" letter-spacing="2.2" fill="${INK}" fill-opacity=".5">${escapeXml(caption)}</text>`,
    `</svg>`,
  ].join("");
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function build({ name, color, hex }: GarmentInput): { defs: string; garment: string } | null {
  const kind = garmentKind(name);
  if (!kind) return null;
  const c = norm(color ?? "");
  const swatch = /^#[0-9a-f]{6}$/i.test(hex) ? hex : FALLBACK;
  const defs = new Defs();
  const fabric = fabricOf(name);
  let base = swatch;
  let tex: string | null = null;
  if (/rayas?/.test(c) || (kind === "teeStriped" && !c)) {
    base = CRUDO;
    tex = defs.stripes(c ? swatch : "#2E4A7A");
  } else if (/floral|estampad/.test(c)) {
    tex = defs.floral(swatch);
  } else if (/jaspead|melange/.test(c)) {
    tex = defs.fabric("heather", swatch);
  } else if (fabric !== "plain") {
    tex = defs.fabric(fabric, swatch);
  }
  const ctx: Ctx = { base, defs, tex, fabric, name: `${name} ${color ?? ""}` };
  const layers = GARMENTS[kind](ctx).filter((l) => (l.d && l.d !== "M0 0" ? true : !!(l.dots?.length || l.lines)));
  return { defs: defs.toString(), garment: renderGarment(layers, ctx) };
}

/** SVG listo para subir (`image/svg+xml`), o null si el nombre no es una prenda reconocida. */
export function garmentSvg(input: GarmentInput): string | null {
  const built = build(input);
  if (!built) return null;
  const caption = input.color ? `Ilustración · ${input.color}` : "Ilustración";
  return scene(input.seed ?? input.name, caption, built.garment, built.defs);
}

/**
 * Sólo la prenda (sin fondo, luna ni texto), en el espacio 800 × 1000 y con
 * los ids prefijados, para componer arte de campaña con varias prendas.
 */
export function garmentParts(input: GarmentInput, prefix: string): { defs: string; body: string } | null {
  const built = build(input);
  if (!built) return null;
  const px = (t: string) => t.replace(/id="/g, `id="${prefix}`).replace(/href="#/g, `href="#${prefix}`).replace(/url\(#/g, `url(#${prefix}`);
  return { defs: px(built.defs), body: px(built.garment) };
}

/** Parte iluminada de un disco en la fase `i` de 8 (0 nueva, 4 llena); "" en luna nueva. */
export const moonLitPath = litPath;
