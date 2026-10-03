#!/usr/bin/env node
/*
 * Capturas reales del producto para la landing (docs/BRAND.md §8, nivel 2).
 *
 *   node scripts/landing-shots.cjs              # todas
 *   node scripts/landing-shots.cjs panel-inicio tienda-demo-m   # sólo esas
 *
 * Genera `public/img/platform/<nombre>.webp` con el Edge instalado (igual que
 * `scripts/shots.cjs`) y las recorta/escala con `sharp` a un tamaño FIJO por
 * captura: la landing (`src/components/platform/landing/shots.ts`) reserva
 * esos mismos width/height en `next/image`, así que se pueden regenerar
 * cuando cambie el panel o las tiendas sin tocar código. Es idempotente:
 * cada corrida pisa los archivos.
 *
 * Requisitos: el servidor de desarrollo corriendo (BASE, por defecto
 * http://localhost:3000), la base de desarrollo con la tienda "demo" y el
 * usuario de /admin/auth/dev-login (docs/DEV-ACCESS.md).
 *
 * Detalles:
 * - Movimiento reducido (`reducedMotion: "reduce"`): todo queda en su estado
 *   final, sin entradas a medio camino.
 * - Se oculta el indicador de desarrollo de Next.
 * - Desktop a 1440 × 900 (1x) → 1280 × 800. Celular a 390 × 844 (2x) → 540 × 1169.
 * - Si una captura falla, se deja la anterior (no se borra nada) y sale con código 1.
 *
 * En Git Bash no hace falta MSYS_NO_PATHCONV (las rutas están acá adentro).
 */
/* eslint-disable @typescript-eslint/no-require-imports -- script de Node en CommonJS, como scripts/shots.cjs */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "public", "img", "platform");
const BASE = process.env.BASE || "http://localhost:3000";

const DESKTOP = { viewport: { width: 1440, height: 900 }, scale: 1, out: [1280, 800] };
const MOBILE = { viewport: { width: 390, height: 844 }, scale: 2, out: [540, 1169] };

/** name → ruta, si entra al panel y el dispositivo. Mantener en sync con `landing/shots.ts`. */
const SHOTS = [
  { name: "panel-inicio", path: "/admin", login: true, device: DESKTOP },
  { name: "panel-pedidos", path: "/admin/pedidos", login: true, device: DESKTOP },
  { name: "panel-productos", path: "/admin/productos", login: true, device: DESKTOP },
  { name: "panel-apariencia", path: "/admin/apariencia", login: true, device: DESKTOP },
  { name: "panel-pedidos-m", path: "/admin/pedidos", login: true, device: MOBILE },
  { name: "tienda-demo", path: "/s/demo", login: false, device: DESKTOP },
  { name: "tienda-demo-m", path: "/s/demo", login: false, device: MOBILE },
  { name: "tienda-luna", path: "/s/taller-luna", login: false, device: DESKTOP },
];

const HIDE_DEV_UI = "nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }";

async function capture(browser, shot) {
  const { device } = shot;
  const ctx = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.scale,
    isMobile: device === MOBILE,
    hasTouch: device === MOBILE,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  try {
    const url = shot.login ? `${BASE}/admin/auth/dev-login?next=${encodeURIComponent(shot.path)}` : BASE + shot.path;
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : "sin respuesta"}`);
    // Página de error de Next (un archivo a medio editar, la base caída…): no pisar la captura buena.
    const broken = await page.evaluate(() => /couldn.t load|Application error|Unhandled Runtime Error|Build Error/i.test(document.body.innerText));
    if (broken) throw new Error("la página muestra un error");
    await page.addStyleTag({ content: HIDE_DEV_UI });
    // Fuentes e imágenes diferidas.
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 400);
      await new Promise((r) => setTimeout(r, 200));
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2200);
    const png = await page.screenshot({ type: "png" });
    const [w, h] = device.out;
    const file = path.join(OUT, `${shot.name}.webp`);
    await sharp(png).resize(w, h, { fit: "cover", position: "top" }).webp({ quality: 82, effort: 5 }).toFile(file);
    console.log("ok  ", shot.name.padEnd(18), `${w}×${h}`, page.url());
    return true;
  } catch (e) {
    console.log("FAIL", shot.name, String(e).slice(0, 240));
    return false;
  } finally {
    await ctx.close();
  }
}

(async () => {
  const only = process.argv.slice(2);
  const list = only.length ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;
  if (!list.length) {
    console.error(`Sin capturas con esos nombres. Disponibles: ${SHOTS.map((s) => s.name).join(", ")}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.SHOTS_CHANNEL || "msedge" });
  let ok = true;
  for (const shot of list) ok = (await capture(browser, shot)) && ok;
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
