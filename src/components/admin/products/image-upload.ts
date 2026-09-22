"use client";

import { nanoid } from "nanoid";

import { createClient } from "@/lib/supabase/client";

/*
 * Subida de imágenes desde el navegador al bucket `media` (la sesión admin
 * tiene permiso por RLS). Antes de subir: redimensiona a máx. 1600px y
 * convierte a WebP (calidad 0.85). SVG y GIF se suben tal cual.
 */

export const MAX_IMAGE_SIDE = 1600;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
export const IMAGE_ACCEPT = ACCEPTED.join(",");

export interface UploadedImage {
  url: string;
  path: string;
  width: number | null;
  height: number | null;
}

export function isAcceptedImage(file: File) {
  return ACCEPTED.includes(file.type);
}

async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number; ext: string; type: string }> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return { blob: file, width: 0, height: 0, ext: file.type === "image/gif" ? "gif" : "svg", type: file.type };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Tu navegador no pudo convertir la imagen.");
  // Safari viejo puede devolver PNG si no soporta WebP: respetamos el tipo real.
  const type = blob.type || "image/webp";
  return { blob, width, height, ext: type === "image/webp" ? "webp" : type.split("/")[1] || "png", type };
}

/** Procesa y sube una imagen a `<folder>/<nanoid>.<ext>`. */
export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  if (!isAcceptedImage(file)) throw new Error(`«${file.name}» no es una imagen compatible (JPG, PNG, WebP, GIF, AVIF o SVG).`);
  if (file.size > 25 * 1024 * 1024) throw new Error(`«${file.name}» pesa más de 25 MB.`);
  const processed = await toWebp(file);
  if (processed.blob.size > MAX_UPLOAD_BYTES) throw new Error(`«${file.name}» sigue pesando más de 10 MB después de optimizarla.`);
  const path = `${folder.replace(/\/+$/, "")}/${nanoid(12)}.${processed.ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("media").upload(path, processed.blob, {
    contentType: processed.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir «${file.name}»: ${error.message}`);
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return {
    url: data.publicUrl,
    path,
    width: processed.width || null,
    height: processed.height || null,
  };
}

/** Borra archivos subidos que no se llegaron a registrar (limpieza ante errores). */
export async function removeUploaded(paths: string[]) {
  if (!paths.length) return;
  await createClient().storage.from("media").remove(paths);
}

/** Imágenes del portapapeles (pegar con Ctrl+V). */
export function imagesFromClipboard(e: ClipboardEvent | React.ClipboardEvent): File[] {
  const items = e.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f && isAcceptedImage(f)) files.push(f);
    }
  }
  return files;
}
