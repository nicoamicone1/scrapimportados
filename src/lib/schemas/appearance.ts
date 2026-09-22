import { z } from "zod";

import { themeSchema } from "@/lib/theme/schema";

/**
 * Apariencia: tema, marca y barra de anuncio (`store_settings`). Agente E.
 * Se usa en el editor (validación en vivo) y en las actions.
 */

export const CUSTOM_CSS_MAX_BYTES = 20 * 1024;

export interface CssIssue {
  message: string;
  /** Línea (1-based) donde aparece el problema, si aplica. */
  line?: number;
}

const FORBIDDEN_CSS: { re: RegExp; message: string }[] = [
  { re: /@import\b/i, message: "No se permite @import: cargá las fuentes desde Tipografía." },
  { re: /url\s*\(\s*['"]?\s*(javascript|vbscript|data:text\/html)/i, message: "No se permiten url() con javascript: ni HTML embebido." },
  { re: /expression\s*\(/i, message: "No se permite expression()." },
  { re: /behavior\s*:|-moz-binding\s*:/i, message: "No se permiten behavior ni -moz-binding." },
  { re: /<\/?\s*(style|script)\b/i, message: "No pegues etiquetas <style> ni <script>: sólo reglas CSS." },
];

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Valida el CSS personalizado. Devuelve la lista de problemas (vacía = OK).
 * Además del saneado de `sanitizeCustomCss` (que se aplica igual al
 * renderizar), acá se rechaza para que el dueño sepa qué corregir.
 */
export function validateCustomCss(css: string): CssIssue[] {
  const issues: CssIssue[] = [];
  if (!css.trim()) return issues;
  const bytes = byteLength(css);
  if (bytes > CUSTOM_CSS_MAX_BYTES) {
    issues.push({ message: `Máximo 20 KB (tiene ${(bytes / 1024).toFixed(1)} KB).` });
  }
  const lines = css.split("\n");
  for (const rule of FORBIDDEN_CSS) {
    const idx = lines.findIndex((l) => rule.re.test(l));
    if (idx !== -1) issues.push({ message: rule.message, line: idx + 1 });
    else if (rule.re.test(css.replace(/\s+/g, " "))) issues.push({ message: rule.message });
  }
  // Llaves balanceadas (evita romper el resto de la hoja).
  let depth = 0;
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(["'])(?:\\.|(?!\1).)*\1/g, "")) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) issues.push({ message: "Revisá las llaves { }: hay una sin cerrar o de más." });
  return issues;
}

/** Tema a guardar: el schema del tema + validación estricta del CSS personalizado. */
export const saveThemeSchema = themeSchema.superRefine((theme, ctx) => {
  const issues = validateCustomCss(theme.custom_css ?? "");
  for (const issue of issues) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["custom_css"], message: issue.message });
  }
});

const hexOrEmpty = z
  .string()
  .trim()
  .regex(/^(#[0-9a-fA-F]{6})?$/, "Usá un color hex (#RRGGBB).")
  .default("");

const optionalUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => !v || /^(https?:\/\/|\/)/i.test(v), "Tiene que ser una URL (https://…) o una ruta (/…).")
  .default("");

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Poné el nombre de la tienda.").max(80, "Hasta 80 caracteres."),
  tagline: z.string().trim().max(160, "Hasta 160 caracteres.").default(""),
  logo_url: optionalUrl,
  favicon_url: optionalUrl,
});
export type BrandInput = z.input<typeof brandSchema>;

export const announcementSchema = z
  .object({
    enabled: z.boolean(),
    text: z.string().trim().max(140, "Hasta 140 caracteres.").default(""),
    href: z
      .string()
      .trim()
      .max(500)
      .refine((v) => !v || /^(\/|#|https?:\/\/)/i.test(v), "Usá una ruta (/productos) o una URL (https://…).")
      .default(""),
    bg: hexOrEmpty,
    fg: hexOrEmpty,
  })
  .superRefine((a, ctx) => {
    if (a.enabled && !a.text) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "Escribí el texto del anuncio." });
    if ((a.bg && !a.fg) || (!a.bg && a.fg)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [a.bg ? "fg" : "bg"], message: "Elegí los dos colores o ninguno." });
    }
  });
export type AnnouncementInput = z.input<typeof announcementSchema>;
