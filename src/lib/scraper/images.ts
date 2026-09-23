import "server-only";

/**
 * Fase "images": descarga las imágenes del origen, las normaliza con sharp
 * (máx. 1600 px, WebP q82) y las sube al bucket `media`
 * (`<store_id>/products/<productId>/<hash>.webp`). Idempotente: las URLs de
 * origen ya procesadas quedan en `products.metadata.imagesRemote` y no se
 * re-bajan. Respeta el límite `images_per_product` del plan (recorta, no falla).
 */
import { createHash } from "node:crypto";

import sharp from "sharp";

import { MEDIA_BUCKET, mediaPath } from "@/lib/media";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

import { fetchRaw } from "./http";
import { toJson } from "./job";
import { optionKey } from "./apply";
import type { NormalizedProduct } from "./types";

export const MAX_IMAGES_PER_PRODUCT = 10;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const CONCURRENCY = 4;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function pool<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export interface ImageResult {
  uploaded: number;
  failed: number;
  skipped: boolean;
  errors: string[];
}

/** Descarga y sube una imagen; devuelve la URL pública y el tamaño final. */
async function processOne(
  db: ServerSupabase,
  storeId: string,
  productId: string,
  remote: string,
): Promise<{ url: string; width: number; height: number }> {
  const { body } = await fetchRaw(remote, { accept: "image/avif,image/webp,image/*;q=0.8", maxBytes: MAX_IMAGE_BYTES, rateLimitMs: 150, attempts: 2 });
  const { data, info } = await sharp(body, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const hash = createHash("sha1").update(remote).digest("hex").slice(0, 16);
  const path = mediaPath(storeId, "products", productId, `${hash}.webp`);
  const up = await db.storage.from(MEDIA_BUCKET).upload(path, data, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) throw new Error(up.error.message);
  return { url: db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl, width: info.width, height: info.height };
}

/**
 * Procesa las imágenes de un producto importado. Si el producto ya tenía
 * imágenes cargadas por otro medio (sin `imagesRemote`), no se agregan
 * duplicados: se registran las URLs del origen como ya vistas.
 */
export async function importProductImages(
  db: ServerSupabase,
  storeId: string,
  productId: string,
  product: NormalizedProduct,
  /** Límite `images_per_product` del plan (`null` = sin límite propio). */
  maxImages: number | null = null,
): Promise<ImageResult> {
  const cap = Math.min(MAX_IMAGES_PER_PRODUCT, maxImages ?? MAX_IMAGES_PER_PRODUCT);
  const variantImages = product.variants.map((v) => v.image_url).filter((u): u is string => Boolean(u));
  const remote = [...new Set([...product.images, ...variantImages])].slice(0, cap);
  const result: ImageResult = { uploaded: 0, failed: 0, skipped: false, errors: [] };
  if (!remote.length) return { ...result, skipped: true };

  const [prodRes, imgRes] = await Promise.all([
    db.from("products").select("id, name, metadata").eq("store_id", storeId).eq("id", productId).maybeSingle(),
    db.from("product_images").select("id, position").eq("store_id", storeId).eq("product_id", productId),
  ]);
  if (!prodRes.data) return { ...result, skipped: true };
  const meta: Record<string, Json | undefined> = isRecord(prodRes.data.metadata) ? { ...prodRes.data.metadata } : {};
  const seen = Array.isArray(meta.imagesRemote) ? meta.imagesRemote.map(String) : null;
  const existingImages = imgRes.data ?? [];

  if (seen === null && existingImages.length > 0) {
    meta.imagesRemote = remote;
    await db.from("products").update({ metadata: toJson(meta) }).eq("store_id", storeId).eq("id", productId);
    return { ...result, skipped: true };
  }

  // Lugar libre según el plan: las que no entran se omiten (no se marcan como vistas).
  const room = Math.max(0, cap - existingImages.length);
  const todo = remote.filter((u) => !(seen ?? []).includes(u)).slice(0, room);
  if (!todo.length) return { ...result, skipped: true };

  const done = await pool(todo, CONCURRENCY, async (u) => {
    try {
      return { remote: u, ...(await processOne(db, storeId, productId, u)) };
    } catch (err) {
      result.failed += 1;
      result.errors.push(`${u}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
  // La ruta en el bucket es determinística (hash de la URL de origen): si otro
  // job concurrente ya registró la misma imagen, no se duplica la fila.
  const already = await db.from("product_images").select("url, position").eq("store_id", storeId).eq("product_id", productId);
  const knownUrls = new Set((already.data ?? []).map((i) => i.url));
  const ok = done.filter((d): d is NonNullable<typeof d> => d !== null && !knownUrls.has(d.url));

  if (ok.length) {
    let position = (already.data ?? existingImages).reduce((m, i) => Math.max(m, i.position), -1) + 1;
    const inserted = await db
      .from("product_images")
      .insert(
        ok.map((d) => ({
          store_id: storeId,
          product_id: productId,
          url: d.url,
          alt: prodRes.data!.name,
          position: position++,
          width: d.width,
          height: d.height,
        })),
      )
      .select("id, url");
    if (inserted.error) throw new Error(`imágenes: ${inserted.error.message}`);
    result.uploaded = ok.length;

    // Imagen por variante.
    const idByRemote = new Map(ok.map((d) => [d.remote, inserted.data.find((r) => r.url === d.url)?.id ?? null]));
    const wanted = product.variants.filter((v) => v.image_url && idByRemote.get(v.image_url));
    if (wanted.length) {
      const vars = await db
        .from("product_variants")
        .select("id, option_values, image_id")
        .eq("store_id", storeId)
        .eq("product_id", productId);
      const byKey = new Map((vars.data ?? []).map((v) => [optionKey(v.option_values), v]));
      for (const v of wanted) {
        const row = byKey.get(optionKey(v.option_values));
        const imageId = idByRemote.get(v.image_url!);
        if (row && imageId && !row.image_id) {
          await db.from("product_variants").update({ image_id: imageId }).eq("store_id", storeId).eq("id", row.id);
        }
      }
    }
  }

  meta.imagesRemote = [...new Set([...(seen ?? []), ...done.flatMap((d) => (d ? [d.remote] : []))])];
  const up = await db.from("products").update({ metadata: toJson(meta) }).eq("store_id", storeId).eq("id", productId);
  if (up.error) throw new Error(`metadata: ${up.error.message}`);
  return result;
}
