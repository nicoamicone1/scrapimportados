import { expect, test, type Page } from "@playwright/test";

/*
 * Smoke del sitio público de la plataforma. Corre sin Supabase (env ficticia):
 * la landing se renderiza sin la sección de planes y el storefront (/s/<slug>)
 * devuelve 404, así que no se prueba acá.
 */

/** Rutas del sitemap de la plataforma (src/app/sitemap.ts). */
const STATIC_ROUTES = ["/", "/planes", "/contacto", "/terminos", "/privacidad", "/ayuda", "/guias"];
/** Muestra de artículos (slugs de src/content/ayuda y src/content/guias). */
const ARTICLE_ROUTES = [
  "/ayuda/importar-csv",
  "/ayuda/primeros-pasos",
  "/guias/boton-de-arrepentimiento",
  "/guias/precio-sin-impuestos-nacionales",
];
const ROUTES = [...STATIC_ROUTES, ...ARTICLE_ROUTES];

/**
 * Errores de consola esperables en este entorno:
 * - `[landing] planes` / `fetch failed`: sin Supabase la landing no trae planes.
 * - `ERR_CERT_AUTHORITY_INVALID` / `googleapis`: Google Fonts detrás de un proxy
 *   con CA propia (contenedores de desarrollo; en CI carga bien).
 */
const CONSOLE_ALLOWLIST = [/\[landing\] planes/, /ERR_CERT_AUTHORITY_INVALID/, /fetch failed/, /googleapis/];

/** Rutas que piden sesión o redirigen: se aceptan 2xx y 3xx. */
const AUTH_PREFIXES = ["/login", "/registro", "/app", "/admin"];
/** El storefront necesita la base: sin Supabase da 404. */
const SKIP_LINK_PREFIXES = ["/s/"];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  const allowed = (text: string) => CONSOLE_ALLOWLIST.some((re) => re.test(text));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = `${msg.text()} ${msg.location().url ?? ""}`;
    if (!allowed(text)) errors.push(`console: ${text}`);
  });
  page.on("pageerror", (err) => {
    const text = `${err.name}: ${err.message}`;
    if (!allowed(text)) errors.push(`pageerror: ${text}`);
  });
  return errors;
}

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`) || (p.endsWith("/") && path.startsWith(p)));
}

for (const route of ROUTES) {
  test(`${route} carga bien, con SEO, sin scroll horizontal ni errores`, async ({ page }) => {
    const errors = watchConsole(page);
    const res = await page.goto(route, { waitUntil: "load" });
    expect(res?.status(), `status de ${route}`).toBe(200);

    // Estructura y SEO.
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    expect((await page.title()).trim()).not.toBe("");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S/);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /\S/);

    // Sin scroll horizontal (el ancho del documento no pasa el del viewport).
    const viewportWidth = page.viewportSize()!.width;
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `scrollWidth de ${route}`).toBeLessThanOrEqual(viewportWidth);

    // Accesibilidad básica: imágenes con alt y botones con nombre.
    const imgsWithoutAlt = await page.locator("img:not([alt])").evaluateAll((els) => els.map((el) => el.outerHTML.slice(0, 160)));
    expect(imgsWithoutAlt, "img sin atributo alt").toEqual([]);
    const unnamedButtons = await page.locator("button").evaluateAll((els) =>
      els
        .filter((el) => {
          const labelledBy = el.getAttribute("aria-labelledby");
          const byRef = labelledBy
            ? labelledBy
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent ?? "")
                .join(" ")
            : "";
          const imgAlt = Array.from(el.querySelectorAll("img[alt], svg title"))
            .map((n) => (n instanceof HTMLImageElement ? n.alt : n.textContent) ?? "")
            .join(" ");
          const name = [el.getAttribute("aria-label"), byRef, el.textContent, el.getAttribute("title"), imgAlt].join(" ");
          return name.trim() === "";
        })
        .map((el) => el.outerHTML.slice(0, 160)),
    );
    expect(unnamedButtons, "button sin nombre accesible").toEqual([]);

    expect(errors, `errores de consola en ${route}`).toEqual([]);
  });
}

test.describe("recursos y links (sólo desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "no depende del viewport");

  test("los links internos del header y el pie responden", async ({ page, request }) => {
    // Sin base, las páginas que leen los planes tardan varios segundos en renderizarse.
    test.slow();
    await page.goto("/");
    const hrefs = await page.locator('header a[href^="/"], footer a[href^="/"]').evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    const paths = [...new Set(hrefs.map((h) => h.split("#")[0] || "/"))].filter((p) => !startsWithAny(p, SKIP_LINK_PREFIXES));
    expect(paths.length).toBeGreaterThan(5);
    test.info().annotations.push({ type: "links", description: paths.join(" ") });

    const results = await Promise.all(paths.map(async (path) => ({ path, status: (await request.get(path, { maxRedirects: 0 })).status() })));
    const failures = results
      .filter(({ path, status }) => !(status >= 200 && status < (startsWithAny(path, AUTH_PREFIXES) ? 400 : 300)))
      .map(({ path, status }) => `${path} → ${status}`);
    expect(failures).toEqual([]);
  });

  test("/robots.txt apunta al sitemap y bloquea el panel", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/User-Agent: \*/i);
    expect(body).toMatch(/Disallow: \/admin/);
    expect(body).toMatch(/Sitemap: \S+\/sitemap\.xml/);
  });

  test("/sitemap.xml lista las rutas públicas y cada <loc> responde 200", async ({ request }) => {
    test.slow();
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");
    const body = await res.text();
    expect(body).toContain("<urlset");
    const paths = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    for (const route of ROUTES) expect(paths, `sitemap incluye ${route}`).toContain(route);

    const results = await Promise.all([...new Set(paths)].map(async (path) => ({ path, status: (await request.get(path, { maxRedirects: 0 })).status() })));
    const failures = results.filter((r) => r.status !== 200).map((r) => `${r.path} → ${r.status}`);
    expect(failures).toEqual([]);
  });

  for (const icon of ["/icon", "/apple-icon"]) {
    test(`${icon} es un PNG`, async ({ request }) => {
      const res = await request.get(icon);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
    });
  }
});

test("/ayuda: el buscador filtra los artículos", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/ayuda");
  const csv = page.locator('a[href="/ayuda/importar-csv"]');
  const zonas = page.locator('a[href="/ayuda/zonas-de-envio"]');
  await expect(zonas.first()).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Buscar en la ayuda" });
  const results = page.getByRole("region", { name: "Resultados de la búsqueda" });
  // Reintenta hasta que el componente esté hidratado y reaccione al input.
  await expect(async () => {
    await search.fill("");
    await search.fill("csv");
    await expect(results).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await expect(results.locator('a[href="/ayuda/importar-csv"]')).toBeVisible();
  await expect(csv).toHaveCount(1);
  await expect(zonas).toHaveCount(0);

  await search.fill("");
  await expect(zonas.first()).toBeVisible();
  expect(errors).toEqual([]);
});
