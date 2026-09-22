/**
 * Slugs: sin acentos, minúsculas, kebab-case. Únicos por tabla (ver `uniqueSlug`).
 * "Café & Té — Edición 2026" → "cafe-y-te-edicion-2026"
 */
export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/**
 * Devuelve un slug libre: prueba `base`, `base-2`, `base-3`…
 * `exists` consulta la tabla (ej. `select id from products where slug = $1`).
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "item";
  if (!(await exists(root))) return root;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Normaliza texto para búsquedas ("Lámpara" → "lampara"). */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
