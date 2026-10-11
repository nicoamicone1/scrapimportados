/**
 * Arte de campaña de «Luna — ropa por fases» → public/demo/luna/*.svg
 *   node node_modules/tsx/dist/cli.mjs scripts/build-luna-art.mts
 * Reusa las ilustraciones de producto (scripts/lib/garment-svg.mts).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { garmentParts, moonLitPath } from "./lib/garment-svg.mjs";

const OUT = path.resolve("public/demo/luna");
mkdirSync(OUT, { recursive: true });

const NIGHT = "#15133A";
const NIGHT2 = "#1F1D52";
const YELLOW = "#F2D76B";
const YELLOW2 = "#E2C35A";
const LAV = "#D6D2E6";
const BG = "#E9E7F0";
const SURF = "#F5F4F8";
const BLOOD = "#B33E27";
const CREAM = "#F4F1E8";

const r1 = (n: number) => Math.round(n * 10) / 10;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Art {
  defs: string[] = [];
  body: string[] = [];
  private n = 0;
  constructor(
    public w: number,
    public h: number,
    public label: string,
  ) {}
  add(s: string) {
    this.body.push(s);
    return this;
  }
  def(s: string) {
    this.defs.push(s);
    return this;
  }
  id(p: string) {
    return `${p}${this.n++}`;
  }
  toString() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" role="img" aria-label="${this.label}" preserveAspectRatio="xMidYMid slice"><defs>${this.defs.join("")}</defs>${this.body.join("")}</svg>`;
  }
}

/** Grano fino (claro sobre noche, tinta sobre claro). */
function grain(a: Art, light: boolean, k = 1) {
  const id = a.id("gr");
  const c = light ? "1" : "0.08";
  a.def(
    `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 0 ${light ? 1 : 0.23} 1.7 0 0 0 -.92"/></filter>`,
  );
  a.add(`<rect width="${a.w}" height="${a.h}" filter="url(#${id})" opacity="${(light ? 0.16 : 0.22) * k}"/>`);
}

function stars(a: Art, seed: number, n: number, box: [number, number, number, number], opts: { max?: number; avoid?: (x: number, y: number) => boolean; color?: string } = {}) {
  const rand = rng(seed);
  const [x0, y0, x1, y1] = box;
  let dots = "";
  let crosses = "";
  for (let i = 0; i < n; i++) {
    const x = x0 + rand() * (x1 - x0);
    const y = y0 + rand() * (y1 - y0);
    if (opts.avoid?.(x, y)) continue;
    const big = rand() > 0.93;
    const op = (0.2 + rand() * 0.6) * (opts.max ?? 1);
    if (big) crosses += `<path d="M${r1(x - 6)} ${r1(y)}H${r1(x + 6)}M${r1(x)} ${r1(y - 6)}V${r1(y + 6)}" stroke-opacity="${r1(op)}"/>`;
    else dots += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(0.6 + rand() * 1.2)}" fill-opacity="${r1(op * 10) / 10}"/>`;
  }
  const c = opts.color ?? CREAM;
  a.add(`<g fill="${c}">${dots}</g><g stroke="${c}" stroke-width="1" stroke-linecap="round">${crosses}</g>`);
}

/** Luna: disco oscuro + parte iluminada, cráteres recortados a la luz, borde fino. */
function moon(a: Art, cx: number, cy: number, r: number, phase: number, o: { lit?: string; dark?: string; rim?: string; craters?: boolean; halo?: boolean } = {}) {
  const lit = o.lit ?? YELLOW;
  const dark = o.dark ?? NIGHT2;
  if (o.halo) a.add(`<circle cx="${cx}" cy="${cy}" r="${r * 1.22}" fill="#1A1844"/><circle cx="${cx}" cy="${cy}" r="${r * 1.1}" fill="#1D1B4D"/>`);
  a.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${dark}"/>`);
  const d = moonLitPath(cx, cy, r, phase);
  if (d) {
    a.add(`<path d="${d}" fill="${lit}"/>`);
    if (o.craters !== false) {
      const id = a.id("mc");
      a.def(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
      const rand = rng(Math.round(cx * 7 + cy));
      let cr = "";
      for (let i = 0; i < 9; i++) {
        const ang = rand() * Math.PI * 2;
        const dist = Math.sqrt(rand()) * r * 0.82;
        const rr = r * (0.04 + rand() * 0.1);
        cr += `<circle cx="${r1(cx + Math.cos(ang) * dist)}" cy="${r1(cy + Math.sin(ang) * dist)}" r="${r1(rr)}"/>`;
      }
      a.add(`<g clip-path="url(#${id})" fill="${YELLOW2}" fill-opacity=".55">${cr}<path d="M${cx - r} ${cy + r * 0.3}Q${cx} ${cy + r * 0.05} ${cx + r} ${cy + r * 0.42}V${cy + r}H${cx - r}Z" fill-opacity=".35"/></g>`);
    }
  }
  a.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${o.rim ?? lit}" stroke-opacity=".35" stroke-width="1.5"/>`);
}

function orbit(a: Art, cx: number, cy: number, r: number, op = 0.22, color = LAV, extra = "") {
  a.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1"${extra}/>`);
}

/** Las 8 fases sobre un arco (ángulos en grados, pantalla). */
function phaseArc(a: Art, cx: number, cy: number, R: number, a0: number, a1: number, size: number, o: { lit?: string; dark?: string; rim?: string; mark?: number } = {}) {
  for (let i = 0; i < 8; i++) {
    const ang = ((a0 + ((a1 - a0) * i) / 7) * Math.PI) / 180;
    const x = r1(cx + Math.cos(ang) * R);
    const y = r1(cy + Math.sin(ang) * R);
    a.add(`<circle cx="${x}" cy="${y}" r="${size}" fill="${o.dark ?? NIGHT2}"/>`);
    const d = moonLitPath(x, y, size, i);
    if (d) a.add(`<path d="${d}" fill="${o.lit ?? YELLOW}"/>`);
    a.add(`<circle cx="${x}" cy="${y}" r="${size}" fill="none" stroke="${o.rim ?? o.lit ?? YELLOW}" stroke-opacity=".55" stroke-width="1"/>`);
    if (o.mark === i) a.add(`<circle cx="${x}" cy="${y}" r="${size + 7}" fill="none" stroke="${BLOOD}" stroke-width="1.5"/>`);
  }
}

/** Fila de fases (tinta sobre claro). */
function phaseRow(a: Art, x0: number, y: number, gap: number, size: number, mark?: number, paper = SURF) {
  for (let i = 0; i < 8; i++) {
    const x = x0 + i * gap;
    a.add(`<circle cx="${x}" cy="${y}" r="${size}" fill="${NIGHT}"/>`);
    const d = moonLitPath(x, y, size, i);
    if (d) a.add(`<path d="${d}" fill="${paper}"/>`);
    a.add(`<circle cx="${x}" cy="${y}" r="${size}" fill="none" stroke="${NIGHT}" stroke-width="1.5"/>`);
    if (mark === i) a.add(`<circle cx="${x}" cy="${y}" r="${size + 9}" fill="none" stroke="${BLOOD}" stroke-width="1.6"/>`);
  }
}

let gid = 0;
/** Ubica una prenda: su punto local (ax, ay) del espacio 800×1000 va a (x, y). */
function garment(a: Art, name: string, color: string, hex: string, x: number, y: number, s: number, rot = 0, o: { ax?: number; ay?: number; before?: string; after?: string } = {}) {
  const parts = garmentParts({ name, color, hex }, `p${gid++}`);
  if (!parts) throw new Error(`sin prenda: ${name}`);
  a.def(parts.defs);
  const ax = o.ax ?? 400;
  const ay = o.ay ?? 520;
  a.add(`<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)}) scale(${s}) translate(${-ax} ${-ay})">${o.before ?? ""}${parts.body}${o.after ?? ""}</g>`);
}

/** Percha (en coordenadas locales de la prenda), con el gancho arriba. */
function hanger(color = LAV, topY = 214) {
  return `<path d="M400 ${topY - 2}V${topY - 30}C400 ${topY - 58} 432 ${topY - 58} 432 ${topY - 36}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/><path d="M262 ${topY + 40}L400 ${topY - 4}L538 ${topY + 40}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Broches de ropa (locales). */
function pins(y = 214, dx = 108, color = CREAM) {
  return [-dx, dx].map((d) => `<rect x="${400 + d - 9}" y="${y - 30}" width="18" height="56" rx="5" fill="${color}" stroke="${NIGHT}" stroke-width="3"/><path d="M${400 + d - 9} ${y - 6}h18" stroke="${NIGHT}" stroke-width="3"/>`).join("");
}

function quad(p0: [number, number], c: [number, number], p2: [number, number], t: number) {
  const x = (1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * c[0] + t * t * p2[0];
  const y = (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * c[1] + t * t * p2[1];
  const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p2[0] - c[0]);
  const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p2[1] - c[1]);
  return { x, y, ang: (Math.atan2(dy, dx) * 180) / Math.PI };
}

function write(name: string, a: Art | string) {
  const s = String(a);
  writeFileSync(path.join(OUT, name), s);
  console.log(`${name.padEnd(28)} ${(s.length / 1024).toFixed(1)} KB`);
}

// ---------------------------------------------------------------------------
// Logo y favicon
// ---------------------------------------------------------------------------

function crescentA(cx: number, cy: number, R: number, r: number, d: number): string {
  // Disco (cx,cy,R) menos disco (cx+d,cy,r): creciente con los cuernos a la derecha.
  const ax = (R * R - r * r + d * d) / (2 * d);
  const hh = Math.sqrt(R * R - ax * ax);
  const x = r1(cx + ax);
  return `M${x} ${r1(cy - hh)}A${R} ${R} 0 1 0 ${x} ${r1(cy + hh)}A${r} ${r} 0 1 1 ${x} ${r1(cy - hh)}Z`;
}

function logo(color: string) {
  // Geométrica, trazo 14: l con cola, u, n y la «a» = creciente + asta (la luna en la letra).
  const cap = `stroke="${color}" stroke-width="14" fill="none" stroke-linecap="butt" stroke-linejoin="round"`;
  const l = "M24 6V64Q24 82 42 82";
  const u = "M64 36V62Q64 82 86 82Q108 82 108 62V36M108 36V89";
  const n = "M138 89V36M138 58Q138 36 160 36Q182 36 182 58V89";
  const stem = "M260 29V89";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 96" width="280" height="96" role="img" aria-label="luna"><path d="${l}${u}${n}${stem}" ${cap}/><path d="${crescentA(233, 59, 30, 23, 11)}" fill="${color}"/></svg>`;
}

write("logo.svg", logo(NIGHT));
write("logo-claro.svg", logo(CREAM));
write(
  "favicon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="32" fill="${NIGHT}"/><circle cx="32" cy="32" r="25" fill="none" stroke="${LAV}" stroke-opacity=".28" stroke-width="1"/><path d="${crescentA(30, 32, 19, 16, 9)}" fill="${YELLOW}"/><circle cx="50" cy="17" r="1.6" fill="${CREAM}"/></svg>`,
);

// ---------------------------------------------------------------------------
// Hero 1600×1000: 45 % izquierdo quieto y oscuro; luna, fases y ropa tendida a la derecha
// ---------------------------------------------------------------------------

{
  const a = new Art(1600, 1000, "Ropa tendida bajo una luna creciente");
  a.add(`<rect width="1600" height="1000" fill="${NIGHT}"/>`);
  stars(a, 11, 70, [0, 0, 720, 1000], { max: 0.4 });
  stars(a, 12, 120, [720, 0, 1600, 1000], { max: 0.9, avoid: (x, y) => Math.hypot(x - 1190, y - 440) < 400 });
  const mx = 1190;
  const my = 440;
  orbit(a, mx, my, 450, 0.2);
  orbit(a, mx, my, 545, 0.14);
  a.add(`<ellipse cx="${mx}" cy="${my}" rx="640" ry="190" transform="rotate(-14 ${mx} ${my})" fill="none" stroke="${LAV}" stroke-opacity=".16" stroke-width="1"/>`);
  moon(a, mx, my, 360, 3, { halo: true });
  phaseArc(a, mx, my, 450, 122, 206, 15);
  // luna de sangre en la órbita grande
  a.add(`<circle cx="${r1(mx + Math.cos((32 * Math.PI) / 180) * 545)}" cy="${r1(my + Math.sin((32 * Math.PI) / 180) * 545)}" r="13" fill="${BLOOD}"/>`);
  // soga
  const P0: [number, number] = [770, 150];
  const C: [number, number] = [1180, 360];
  const P2: [number, number] = [1640, 196];
  a.add(`<path d="M${P0[0]} ${P0[1]}Q${C[0]} ${C[1]} ${P2[0]} ${P2[1]}" fill="none" stroke="${CREAM}" stroke-opacity=".75" stroke-width="2"/>`);
  const hang = (t: number, name: string, color: string, hex: string, s: number, ay = 236) => {
    const q = quad(P0, C, P2, t);
    garment(a, name, color, hex, q.x, q.y, s, q.ang * 0.6, { ay, after: pins(ay - 8) });
  };
  hang(0.24, "Remera rayada marinera", "Rayas azules", "#2E4A7A", 0.44, 250);
  hang(0.5, "Vestido midi de fibrana estampado", "Floral terracota", "#C27A54", 0.56, 240);
  hang(0.77, "Camisa de lino holgada", "Crudo", "#EAE2D2", 0.46, 262);
  grain(a, true);
  write("hero.svg", a);
}

// Hero mobile 900×1200: la escena arriba (50 %); abajo noche lisa para el texto crema.
{
  const a = new Art(900, 1200, "Ropa tendida bajo una luna creciente");
  a.add(`<rect width="900" height="1200" fill="${NIGHT}"/>`);
  const mx = 520;
  const my = 280;
  stars(a, 22, 70, [0, 0, 900, 600], { max: 0.85, avoid: (x, y) => Math.hypot(x - mx, y - my) < 290 });
  stars(a, 21, 60, [0, 600, 900, 1200], { max: 0.32 });
  orbit(a, mx, my, 300, 0.2);
  moon(a, mx, my, 230, 3, { halo: true });
  phaseArc(a, mx, my, 300, 150, 246, 11);
  const P0: [number, number] = [-20, 130];
  const C: [number, number] = [430, 330];
  const P2: [number, number] = [940, 150];
  a.add(`<path d="M${P0[0]} ${P0[1]}Q${C[0]} ${C[1]} ${P2[0]} ${P2[1]}" fill="none" stroke="${CREAM}" stroke-opacity=".75" stroke-width="2"/>`);
  const hang = (t: number, name: string, color: string, hex: string, s: number, ay: number) => {
    const q = quad(P0, C, P2, t);
    garment(a, name, color, hex, q.x, q.y, s, q.ang * 0.6, { ay, after: pins(ay - 8) });
  };
  hang(0.27, "Remera rayada marinera", "Rayas azules", "#2E4A7A", 0.36, 250);
  hang(0.5, "Vestido midi de fibrana estampado", "Floral terracota", "#C27A54", 0.42, 240);
  hang(0.74, "Camisa de lino holgada", "Crudo", "#EAE2D2", 0.36, 262);
  grain(a, true);
  write("hero-mobile.svg", a);
}

// ---------------------------------------------------------------------------
// Lookbook «Fase creciente» 1200×1500: ventana en arco con la noche, prendas delante
// ---------------------------------------------------------------------------

{
  const a = new Art(1200, 1500, "Fase creciente: vestido floral, saco trenzado y pañuelo");
  a.add(`<rect width="1200" height="1500" fill="${BG}"/>`);
  orbit(a, 600, 560, 520, 0.18, NIGHT);
  a.add(`<ellipse cx="600" cy="760" rx="580" ry="230" transform="rotate(-12 600 760)" fill="none" stroke="${NIGHT}" stroke-opacity=".12" stroke-width="1"/>`);
  const arch = "M230 1330V560A370 370 0 0 1 970 560V1330Z";
  const clip = a.id("arch");
  a.def(`<clipPath id="${clip}"><path d="${arch}"/></clipPath>`);
  a.add(`<path d="${arch}" fill="${NIGHT}"/><g clip-path="url(#${clip})">`);
  stars(a, 31, 160, [230, 190, 970, 1330], { max: 0.9, avoid: (x, y) => Math.hypot(x - 600, y - 520) < 240 });
  orbit(a, 600, 520, 300, 0.22);
  orbit(a, 600, 520, 360, 0.14);
  moon(a, 600, 520, 230, 2, { halo: true });
  a.add(`</g>`);
  a.add(`<path d="${arch}" fill="none" stroke="${NIGHT}" stroke-width="2"/><path d="M212 1348V560A388 388 0 0 1 988 560V1348" fill="none" stroke="${NIGHT}" stroke-opacity=".4" stroke-width="1"/>`);
  // barral de la ventana
  a.add(`<path d="M300 330H900" stroke="${CREAM}" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>`);
  garment(a, "Vestido midi de fibrana estampado", "Floral azul", "#3E5A80", 600, 330, 1.02, 0, { ay: 168, before: hanger(CREAM, 222) });
  garment(a, "Saco de hilo trenzado", "Caramelo", "#A26C3A", 950, 1180, 0.56, -9);
  garment(a, "Pañuelo de seda estampado", "Floral terracota", "#C27A54", 300, 1260, 0.5, 12, { ay: 455 });
  a.add(`<path d="M120 1400H1080" stroke="${NIGHT}" stroke-opacity=".25" stroke-width="1"/>`);
  phaseRow(a, 600 - 3.5 * 52, 1446, 52, 11, 2, BG);
  grain(a, false);
  write("lookbook-creciente.svg", a);
}

// ---------------------------------------------------------------------------
// Taller 1200×1200: ciclo lunar en la pared, muestra en percha, mesa de corte con moldería
// ---------------------------------------------------------------------------

{
  const a = new Art(1200, 1200, "Taller: calendario lunar, moldería, tijera y cinta métrica sobre la mesa de corte");
  a.add(`<rect width="1200" height="1200" fill="${BG}"/>`);
  // calendario lunar
  a.add(`<rect x="140" y="96" width="920" height="170" fill="${SURF}" stroke="${NIGHT}" stroke-opacity=".55" stroke-width="1.5"/>`);
  a.add(`<path d="M140 228H1060" stroke="${NIGHT}" stroke-opacity=".18"/>`);
  phaseRow(a, 220, 168, 108, 34, 2);
  for (let i = 0; i < 8; i++) a.add(`<path d="M${220 + i * 108} 236V250" stroke="${NIGHT}" stroke-opacity=".5" stroke-width="1.5"/>`);
  a.add(`<circle cx="160" cy="112" r="6" fill="${BLOOD}"/><circle cx="1040" cy="112" r="6" fill="${BLOOD}"/>`);
  // barral con muestras en percha
  a.add(`<path d="M330 340H1010" stroke="${NIGHT}" stroke-width="5" stroke-linecap="round"/><path d="M330 340V318M1010 340V318" stroke="${NIGHT}" stroke-width="5" stroke-linecap="round"/>`);
  garment(a, "Camisa de poplín clásica", "Blanco", "#F4F2EE", 500, 340, 0.44, 0, { ay: 168, before: hanger(NIGHT, 222) });
  garment(a, "Vestido camisero de lino", "Negro", "#1B1A18", 690, 340, 0.4, 0, { ay: 168, before: hanger(NIGHT, 222) });
  garment(a, "Saco de hilo trenzado", "Crudo", "#EAE2D2", 870, 340, 0.42, 0, { ay: 168, before: hanger(NIGHT, 222) });
  // cinta métrica colgando del extremo del barral
  {
    const tape = "M990 344C1000 420 990 520 1000 600M1012 344C1030 410 1036 470 1028 540";
    a.add(`<path d="${tape}" fill="none" stroke="${NIGHT}" stroke-width="20" stroke-linecap="round"/><path d="${tape}" fill="none" stroke="${CREAM}" stroke-width="15" stroke-linecap="round"/><path d="${tape}" fill="none" stroke="${NIGHT}" stroke-width="7" stroke-dasharray="1.5 8" stroke-opacity=".8"/>`);
  }
  // moldería colgada de un gancho (izquierda)
  a.add(`<circle cx="210" cy="330" r="5" fill="${NIGHT}"/><path d="M210 330V356" stroke="${NIGHT}" stroke-width="3"/>`);
  const hung = (rot: number, d: string, fill: string) =>
    a.add(`<g transform="rotate(${rot} 210 372)"><path d="${d}" fill="${fill}" stroke="${NIGHT}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="210" cy="372" r="7" fill="${BG}" stroke="${NIGHT}" stroke-width="2"/></g>`);
  hung(-9, "M150 356H262L280 470Q246 500 252 560L262 650H140Z", "#E4DCCB");
  hung(4, "M140 352H276L290 520Q250 560 254 620L262 680H132Z", SURF);
  hung(-2, "M156 360H250Q270 420 262 500Q300 560 270 640H150Q140 520 156 360Z", CREAM);
  a.add(`<path d="M190 430V600M182 444L190 428L198 444M182 586L190 602L198 586" fill="none" stroke="${BLOOD}" stroke-width="2" transform="rotate(-2 210 372)"/><path d="M168 380H252M164 640H258" stroke="${NIGHT}" stroke-opacity=".5" stroke-dasharray="6 5" transform="rotate(-2 210 372)"/>`);
  // mesa: plancha de corte noche con grilla
  a.add(`<rect y="700" width="1200" height="500" fill="${NIGHT}"/><rect y="700" width="1200" height="14" fill="${NIGHT2}"/>`);
  let grid = "";
  for (let x = 40; x < 1200; x += 40) grid += `M${x} 714V1200`;
  for (let y = 740; y < 1200; y += 40) grid += `M0 ${y}H1200`;
  let grid2 = "";
  for (let x = 200; x < 1200; x += 200) grid2 += `M${x} 714V1200`;
  for (let y = 900; y < 1200; y += 200) grid2 += `M0 ${y}H1200`;
  a.add(`<path d="${grid}" stroke="${LAV}" stroke-opacity=".12" stroke-width="1"/><path d="${grid2}" stroke="${LAV}" stroke-opacity=".28" stroke-width="1"/>`);
  // tela floral debajo de la moldería
  {
    const id = "flt";
    a.def(
      `<pattern id="${id}" width="44" height="44" patternUnits="userSpaceOnUse"><rect width="44" height="44" fill="#C27A54"/><g fill="#F4ECDD"><circle cx="11" cy="8" r="4"/><circle cx="16" cy="12" r="4"/><circle cx="13" cy="18" r="4"/><circle cx="7" cy="17" r="4"/><circle cx="5" cy="11" r="4"/><circle cx="34" cy="30" r="3.4"/><circle cx="38" cy="35" r="3.4"/><circle cx="32" cy="38" r="3.4"/><circle cx="28" cy="33" r="3.4"/></g><circle cx="10.5" cy="13" r="2.6" fill="#6B1E2A"/><circle cx="33" cy="34" r="2.2" fill="#6B1E2A"/></pattern>`,
    );
    a.add(`<path d="M640 760L1180 790L1150 1190L600 1160Z" fill="url(#${id})" stroke="${NIGHT}" stroke-width="2"/><path d="M640 760L1180 790L1176 830L638 800Z" fill="${NIGHT}" fill-opacity=".12"/>`);
  }
  // moldería en papel
  const piece = (d: string, inner: string, grainLine: string, notches: string) =>
    a.add(
      `<path d="${d}" fill="${CREAM}" stroke="${NIGHT}" stroke-width="2.5" stroke-linejoin="round"/><path d="${inner}" fill="none" stroke="${NIGHT}" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="7 6"/><path d="${grainLine}" fill="none" stroke="${BLOOD}" stroke-width="2"/><path d="${notches}" stroke="${NIGHT}" stroke-width="2.5"/>`,
    );
  // delantero (cuerpo)
  piece(
    "M110 770L250 760Q262 800 300 806L404 790L430 900Q392 930 400 980L420 1130L120 1140Z",
    "M130 790L242 782Q258 822 298 828L388 814L408 902Q372 934 380 982L398 1112L140 1120Z",
    "M250 870V1060M240 884L250 868L260 884M240 1046L250 1062L260 1046",
    "M268 1132v14M110 960h-12",
  );
  // manga
  piece(
    "M470 1120Q470 900 560 830Q620 790 690 830Q780 900 780 1120Z",
    "M492 1100Q494 912 566 852Q622 814 682 852Q752 912 758 1100Z",
    "M625 900V1070M615 914L625 898L635 914M615 1056L625 1072L635 1056",
    "M560 832l-6 -12M690 832l6 -12M625 806v-12",
  );
  // tijera sobre la mesa
  a.add(
    `<g transform="translate(860 1020) rotate(-28)"><path d="M0 -8L250 -2L0 12Z" fill="${LAV}" stroke="${NIGHT}" stroke-width="3" stroke-linejoin="round"/><path d="M0 8L240 26L0 -10Z" fill="#C9C5DA" stroke="${NIGHT}" stroke-width="3" stroke-linejoin="round"/><circle cx="8" cy="1" r="6" fill="${NIGHT}" stroke="${LAV}" stroke-width="2"/><ellipse cx="-62" cy="-26" rx="44" ry="26" fill="none" stroke="${BLOOD}" stroke-width="13"/><ellipse cx="-58" cy="34" rx="38" ry="24" fill="none" stroke="${BLOOD}" stroke-width="13"/><path d="M-24 -14L4 -4M-22 22L4 6" stroke="${BLOOD}" stroke-width="13" stroke-linecap="round"/></g>`,
  );
  // cinta métrica amarilla sobre la noche
  {
    const t = "M30 1190C120 1100 300 1180 420 1150C520 1126 560 1060 520 1010";
    a.add(`<path d="${t}" fill="none" stroke="${YELLOW}" stroke-width="20" stroke-linecap="round"/><path d="${t}" fill="none" stroke="${NIGHT}" stroke-opacity=".7" stroke-width="9" stroke-dasharray="1.5 8"/>`);
  }
  // alfiletero y tiza
  a.add(`<circle cx="1080" cy="1080" r="40" fill="${BLOOD}" stroke="${NIGHT}" stroke-width="3"/><path d="M1044 1080H1116M1080 1044V1116" stroke="${NIGHT}" stroke-opacity=".35" stroke-width="2"/>`);
  for (const [x, y] of [[1066, 1062], [1098, 1070], [1078, 1102]]) a.add(`<path d="M${x} ${y}l-14 -26" stroke="${LAV}" stroke-width="2"/><circle cx="${x - 14}" cy="${y - 26}" r="4.5" fill="${CREAM}" stroke="${NIGHT}" stroke-width="2"/>`);
  a.add(`<path d="M520 760L590 744L566 796Z" fill="${BLOOD}" stroke="${NIGHT}" stroke-width="2"/>`);
  grain(a, false, 0.8);
  write("taller.svg", a);
}

// ---------------------------------------------------------------------------
// Banners de categoría 1200×900
// ---------------------------------------------------------------------------

{
  const a = new Art(1200, 900, "Remeras: rayada, básica y holgada sobre una luna llena");
  a.add(`<rect width="1200" height="900" fill="${NIGHT}"/>`);
  stars(a, 41, 46, [0, 0, 420, 900], { max: 0.4 });
  stars(a, 42, 70, [420, 0, 1200, 900], { avoid: (x, y) => Math.hypot(x - 840, y - 450) < 330 });
  orbit(a, 840, 450, 380, 0.2);
  orbit(a, 840, 450, 440, 0.12);
  moon(a, 840, 450, 310, 4, { halo: true });
  garment(a, "Remera holgada de algodón peinado", "Verde oliva", "#66683F", 1000, 470, 0.56, 9);
  garment(a, "Remera básica de algodón", "Arena", "#D8C7A8", 660, 500, 0.56, -10);
  garment(a, "Remera rayada marinera", "Rayas azules", "#2E4A7A", 830, 470, 0.6, 1);
  phaseArc(a, 840, 450, 440, 150, 210, 11, { mark: 4 });
  grain(a, true);
  write("banner-remeras.svg", a);
}
{
  const a = new Art(1200, 900, "Vestidos colgados de un barral delante de una luna menguante");
  a.add(`<rect width="1200" height="900" fill="${NIGHT}"/>`);
  stars(a, 51, 46, [0, 0, 420, 900], { max: 0.4 });
  stars(a, 52, 70, [420, 0, 1200, 900], { avoid: (x, y) => Math.hypot(x - 820, y - 470) < 330 });
  orbit(a, 820, 470, 390, 0.2);
  moon(a, 820, 470, 320, 6, { halo: true });
  a.add(`<path d="M430 150H1200" stroke="${CREAM}" stroke-opacity=".75" stroke-width="3"/>`);
  garment(a, "Vestido largo con breteles", "Verde oliva", "#66683F", 560, 150, 0.6, 0, { ay: 150, before: hanger(CREAM, 200).replace(/M262 \d+L400 \d+L538 \d+/, "M300 268L400 196L500 268") });
  garment(a, "Vestido camisero de lino", "Crudo", "#EAE2D2", 1010, 150, 0.58, 0, { ay: 160, before: hanger(CREAM, 222) });
  garment(a, "Vestido midi de fibrana estampado", "Floral azul", "#3E5A80", 790, 150, 0.62, 0, { ay: 160, before: hanger(CREAM, 222) });
  grain(a, true);
  write("banner-vestidos.svg", a);
}
{
  const a = new Art(1200, 900, "Accesorios: pañuelo, bufanda y medias sobre una luna nueva");
  a.add(`<rect width="1200" height="900" fill="${BG}"/>`);
  orbit(a, 820, 440, 390, 0.2, NIGHT);
  a.add(`<ellipse cx="820" cy="440" rx="520" ry="170" transform="rotate(-16 820 440)" fill="none" stroke="${NIGHT}" stroke-opacity=".14" stroke-width="1"/>`);
  a.add(`<circle cx="820" cy="440" r="320" fill="${NIGHT}"/>`);
  const clip = a.id("nm");
  a.def(`<clipPath id="${clip}"><circle cx="820" cy="440" r="320"/></clipPath>`);
  a.add(`<g clip-path="url(#${clip})">`);
  stars(a, 61, 60, [500, 120, 1140, 760]);
  a.add(`</g><path d="${crescentA(820, 440, 320, 312, 14).replace(/A320 320 0 1 0/, "A320 320 0 1 0")}" fill="${YELLOW}" transform="rotate(180 820 440)"/>`);
  a.add(`<circle cx="820" cy="440" r="324" fill="none" stroke="${NIGHT}" stroke-width="8"/>`);
  garment(a, "Bufanda tejida de lana", "Bordó", "#6B1E2A", 1010, 420, 0.62, 10);
  garment(a, "Pañuelo de seda estampado", "Floral terracota", "#C27A54", 700, 400, 0.6, -6, { ay: 455 });
  garment(a, "Medias de algodón por 3 pares", "Surtido claro", "#DCD5C8", 690, 650, 0.46, -6, { ay: 420 });
  phaseRow(a, 820 - 3.5 * 40, 846, 40, 8, 0, BG);
  grain(a, false);
  write("banner-accesorios.svg", a);
}

// ---------------------------------------------------------------------------
// Imágenes de categoría 800×1000 (se recortan en arco): la prenda emblemática, noche y una fase
// ---------------------------------------------------------------------------

const cats: [string, string, string, string, number, number?][] = [
  ["cat-remeras.svg", "Remera rayada marinera", "Rayas azules", "#2E4A7A", 1],
  ["cat-buzos-y-camperas.svg", "Campera de corderoy con corderito", "Caramelo", "#A26C3A", 2],
  ["cat-pantalones.svg", "Pantalón wide beige", "Beige", "#D9C6A5", 3],
  ["cat-vestidos.svg", "Vestido midi de fibrana estampado", "Floral terracota", "#C27A54", 4],
  ["cat-camisas.svg", "Camisa de lino holgada", "Celeste", "#A9C6DD", 5],
  ["cat-accesorios.svg", "Pañuelo de seda estampado", "Floral azul", "#3E5A80", 6, 470],
];
cats.forEach(([file, name, color, hex, phase, ay], i) => {
  const a = new Art(800, 1000, `${name}, ${color.toLowerCase()}`);
  a.add(`<rect width="800" height="1000" fill="${NIGHT}"/>`);
  stars(a, 70 + i, 70, [0, 0, 800, 1000], { avoid: (x, y) => Math.hypot(x - 400, y - 470) < 300 });
  orbit(a, 400, 470, 350, 0.2);
  a.add(`<ellipse cx="400" cy="470" rx="420" ry="130" transform="rotate(${-16 + i * 6} 400 470)" fill="none" stroke="${LAV}" stroke-opacity=".14" stroke-width="1"/>`);
  moon(a, 400, 470, 290, phase, { halo: true });
  garment(a, name, color, hex, 400, 520, 0.94, 0, { ay: ay ?? 520 });
  grain(a, true);
  write(file, a);
});
