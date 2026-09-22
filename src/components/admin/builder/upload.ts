"use client";

import { nanoid } from "nanoid";

import { createClient } from "@/lib/supabase/client";

/*
 * Subida de imágenes de campaña (hero, banners, logo) al bucket `media`
 * desde el navegador (la sesión admin tiene permiso por RLS). Redimensiona a
 * `maxSide` y convierte a WebP; SVG y GIF se suben tal cual.
 */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
export const IMAGE_ACCEPT = ACCEPTED.join(",");

async function process(file: File, maxSide: number): Promise<{ blob: Blob; ext: string; type: string }> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    const ext = file.type === "image/gif" ? "gif" : "svg";
    return { blob: file, ext, type: file.type };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
  if (!blob) throw new Error("Tu navegador no pudo convertir la imagen.");
  const type = blob.type || "image/webp";
  return { blob, ext: type === "image/webp" ? "webp" : type.split("/")[1] || "png", type };
}

/** Sube a `media/<folder>/<id>.<ext>` y devuelve la URL pública. */
export async function uploadMedia(file: File, folder: "pages" | "brand", maxSide = 2400): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Usá una imagen JPG, PNG, WebP, GIF, AVIF o SVG.");
  if (file.size > 25 * 1024 * 1024) throw new Error("La imagen pesa más de 25 MB.");
  const { blob, ext, type } = await process(file, maxSide);
  if (blob.size > 10 * 1024 * 1024) throw new Error("La imagen sigue pesando más de 10 MB después de optimizarla.");
  const path = `${folder}/${nanoid(12)}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}
