#!/usr/bin/env node
/**
 * Descarga las imágenes de data/products.json a public/img/ y reescribe
 * `image` / `images` con rutas locales (/img/...). Las URLs originales
 * quedan en `imagesRemote`. Idempotente: no vuelve a bajar lo que ya existe.
 *
 * Las imágenes se redimensionan a MAX_PX y se guardan como WebP (sharp).
 * Uso: node scripts/download-images.mjs [--concurrency=4] [--force] [--max=800]
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data", "products.json");
const OUT_DIR = path.join(ROOT, "public", "img");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) catalogo-scraper/1.0";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const CONCURRENCY = Number(args.concurrency ?? 4);
const FORCE = args.force === "true";
const MAX_PX = Number(args.max ?? 800);

const exists = (p) => access(p).then(() => true, () => false);

async function download(url, baseName, attempt = 1) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*" } });
  if (!res.ok) {
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return download(url, baseName, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `${baseName}.webp`;
  await sharp(buf)
    .rotate()
    .resize({ width: MAX_PX, height: MAX_PX, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 82 })
    .toFile(path.join(OUT_DIR, file));
  return file;
}

async function findExisting(baseName) {
  return (await exists(path.join(OUT_DIR, `${baseName}.webp`))) ? `${baseName}.webp` : null;
}

async function main() {
  const catalog = JSON.parse(await readFile(DATA, "utf8"));
  await mkdir(OUT_DIR, { recursive: true });

  // Lista de trabajos: (producto, índice, url remota)
  const jobs = [];
  for (const p of catalog.products) {
    const remote = p.imagesRemote ?? p.images ?? [];
    p.imagesRemote = remote;
    p.images = new Array(remote.length).fill(null);
    remote.forEach((url, i) => jobs.push({ p, i, url }));
  }

  let done = 0, downloaded = 0, failed = 0;
  const total = jobs.length;
  const queue = jobs.slice();

  async function worker() {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      const { p, i, url } = job;
      const baseName = `${p.id}-${i}`;
      try {
        let file = FORCE ? null : await findExisting(baseName);
        if (!file) {
          file = await download(url, baseName);
          downloaded++;
          await new Promise((r) => setTimeout(r, 150));
        }
        p.images[i] = `/img/${file}`;
      } catch (err) {
        failed++;
        p.images[i] = url; // fallback: dejar la remota
        process.stderr.write(`\n  ✗ ${baseName} ${url} → ${err.message}\n`);
      }
      done++;
      if (done % 25 === 0 || done === total) {
        process.stderr.write(`\r  imágenes ${done}/${total} (nuevas ${downloaded}, errores ${failed})`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stderr.write("\n");

  for (const p of catalog.products) p.image = p.images[0] ?? null;
  await writeFile(DATA, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.error(`Listo: ${total} imágenes, ${downloaded} descargadas, ${failed} fallidas. Carpeta: public/img`);
}

main().catch((e) => { console.error(e); process.exit(1); });
