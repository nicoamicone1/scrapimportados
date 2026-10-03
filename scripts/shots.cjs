#!/usr/bin/env node
/*
 * Capturas de pantalla con el Edge instalado (sin descargar navegadores).
 *
 *   node scripts/shots.cjs <carpeta> <nombre>=<ruta>[@login][@mobile][@full][@dark] ...
 *
 *   @login   entra antes por /admin/auth/dev-login (sólo dev; ver docs/DEV-ACCESS.md)
 *   @mobile  390 × 844 a 2x          @full  página completa
 *   @wait    espera 2,5 s más (animaciones, fuentes)
 *
 * Ej.: node scripts/shots.cjs .shots landing=/@full panel=/admin@login tienda=/s/demo@mobile@full
 * BASE=http://localhost:3000 por defecto. En Git Bash anteponé MSYS_NO_PATHCONV=1
 * (si no, convierte "/admin" en una ruta de Windows).
 */
/* eslint-disable @typescript-eslint/no-require-imports -- script de Node en CommonJS */
const fs = require("node:fs");
const { chromium } = require("@playwright/test");

(async () => {
  const [outDir, ...specs] = process.argv.slice(2);
  if (!outDir || !specs.length) {
    console.error("Uso: node scripts/shots.cjs <carpeta> <nombre>=<ruta>[@login][@mobile][@full][@wait] ...");
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const base = process.env.BASE || "http://localhost:3000";
  const browser = await chromium.launch({ channel: process.env.SHOTS_CHANNEL || "msedge" });
  for (const spec of specs) {
    const eq = spec.indexOf("=");
    const name = spec.slice(0, eq);
    const [path, ...flags] = spec.slice(eq + 1).split("@");
    const mobile = flags.includes("mobile");
    const ctx = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
      locale: "es-AR",
      timezoneId: "America/Argentina/Buenos_Aires",
    });
    const page = await ctx.newPage();
    try {
      const url = flags.includes("login") ? base + "/admin/auth/dev-login?next=" + encodeURIComponent(path) : base + path;
      await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
      if (flags.includes("full")) {
        // Recorre la página para disparar lazy-loading y animaciones ligadas al scroll.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
        });
      }
      await page.waitForTimeout(flags.includes("wait") ? 3300 : 800);
      await page.screenshot({ path: outDir + "/" + name + ".png", fullPage: flags.includes("full") });
      console.log("ok  ", name, page.url());
    } catch (e) {
      console.log("FAIL", name, String(e).slice(0, 240));
    }
    await ctx.close();
  }
  await browser.close();
})();
