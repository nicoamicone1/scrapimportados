/**
 * Recorre una carpeta del bucket y devuelve todos los archivos (la API de
 * Storage lista de a un nivel: las carpetas vienen con `id: null`). Puro,
 * sin Supabase: `list` lo inyecta quien llama (y los tests).
 */

export interface StorageEntry {
  name: string;
  /** `null` = carpeta. */
  id: string | null;
}

export type ListFolder = (prefix: string, offset: number, limit: number) => Promise<StorageEntry[]>;

export const STORAGE_PAGE = 1000;

export async function collectStoragePaths(root: string, list: ListFolder, opts: { maxFiles?: number } = {}): Promise<string[]> {
  const maxFiles = opts.maxFiles ?? 50_000;
  const files: string[] = [];
  const queue = [root.replace(/\/+$/, "")];
  while (queue.length) {
    const prefix = queue.shift()!;
    for (let offset = 0; ; offset += STORAGE_PAGE) {
      const entries = await list(prefix, offset, STORAGE_PAGE);
      for (const e of entries) {
        const path = `${prefix}/${e.name}`;
        if (e.id === null) queue.push(path);
        else files.push(path);
        if (files.length >= maxFiles) return files;
      }
      if (entries.length < STORAGE_PAGE) break;
    }
  }
  return files;
}

/** La confirmación es la dirección de la tienda, sin importar mayúsculas ni espacios. */
export function purgeConfirmMatches(typed: string, slug: string): boolean {
  return typed.trim().toLowerCase() === slug.toLowerCase();
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
