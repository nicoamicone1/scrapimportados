/**
 * Saneado de HTML por allowlist, sin dependencias (sirve en server y client).
 *
 * Estrategia: se tokeniza el HTML y se RE-SERIALIZA desde cero. Nada del
 * markup original pasa tal cual: sólo tags permitidos, con atributos
 * permitidos, valores re-escapados y URLs con protocolo seguro. El texto se
 * escapa. Los tags peligrosos (script, style, iframe…) se descartan con todo
 * su contenido; el resto de tags no permitidos se quitan conservando el texto.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
  "blockquote", "code", "pre", "ul", "ol", "li", "a", "img", "span", "div",
  "figure", "figcaption", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

/** Tags cuyo CONTENIDO también se descarta. */
const DROP_WITH_CONTENT = new Set([
  "script", "style", "iframe", "object", "embed", "noscript", "template", "textarea",
  "select", "svg", "math", "head", "title", "frameset", "frame", "xmp", "plaintext", "noembed",
]);

const GLOBAL_ATTRS = new Set(["class", "id", "title", "dir", "lang"]);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
  ol: new Set(["start", "type", "reversed"]),
};

const URL_ATTRS = new Set(["href", "src"]);
const SAFE_PROTOCOL = /^(https?:|mailto:|tel:)/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto: decodifica entidades y vuelve a escapar (normaliza `&`, `<`, `>`). */
function cleanText(text: string): string {
  return escapeHtml(decodeEntities(text));
}

/** ¿URL segura? Permite http(s), mailto, tel y relativas (/, #, ?, ./). */
export function isSafeUrl(raw: string): boolean {
  // Quitar espacios y caracteres de control que los navegadores ignoran.
  const value = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
  if (!value) return false;
  if (value.startsWith("//")) return true; // protocolo relativo → http(s)
  if (/^[/#?.]/.test(value)) return true;
  if (SAFE_PROTOCOL.test(value)) return true;
  // Sin esquema (ej. "productos/x"): relativa.
  return !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function sanitizeAttrs(tag: string, rawAttrs: string): string {
  const allowed = TAG_ATTRS[tag];
  const out: string[] = [];
  let target: string | null = null;
  const seen = new Set<string>();

  for (const m of rawAttrs.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (seen.has(name)) continue;
    if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue;
    const value = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
    if (URL_ATTRS.has(name) && !isSafeUrl(value)) continue;
    if ((name === "width" || name === "height" || name === "colspan" || name === "rowspan" || name === "start") && !/^\d{1,5}$/.test(value)) continue;
    if (name === "target") {
      if (value !== "_blank" && value !== "_self") continue;
      target = value;
    }
    if (name === "rel") continue; // se recalcula abajo
    seen.add(name);
    out.push(`${name}="${escapeHtml(value)}"`);
  }

  if (tag === "a" && target === "_blank") out.push('rel="noopener noreferrer"');
  return out.length ? ` ${out.join(" ")}` : "";
}

const TOKEN_RE = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![^>]*>?|<\?[^>]*>?|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;

export interface SanitizeOptions {
  /** Tags extra a permitir (además del allowlist por defecto). */
  allowTags?: string[];
}

/** Sanea HTML de usuario (rich text del builder, descripciones de productos). */
export function sanitizeHtml(input: string | null | undefined, options: SanitizeOptions = {}): string {
  if (!input) return "";
  const allowedTags = options.allowTags ? new Set([...ALLOWED_TAGS, ...options.allowTags]) : ALLOWED_TAGS;

  let out = "";
  let last = 0;
  const open: string[] = [];
  let dropping: string | null = null;

  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(input))) {
    const text = input.slice(last, m.index);
    last = TOKEN_RE.lastIndex;

    if (!dropping && text) out += cleanText(text);

    const [, closing, rawName, rawAttrs = "", selfClose] = m;
    if (!rawName) continue; // comentario, doctype, CDATA, PI → fuera

    const tag = rawName.toLowerCase();

    if (dropping) {
      if (closing && tag === dropping) dropping = null;
      continue;
    }
    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing && !selfClose) dropping = tag;
      continue;
    }
    if (!allowedTags.has(tag)) continue;

    if (closing) {
      if (VOID_TAGS.has(tag)) continue;
      const idx = open.lastIndexOf(tag);
      if (idx === -1) continue;
      // Cierra también los que quedaron abiertos adentro.
      while (open.length > idx) out += `</${open.pop()}>`;
      continue;
    }

    out += `<${tag}${sanitizeAttrs(tag, rawAttrs)}>`;
    if (!VOID_TAGS.has(tag) && !selfClose) open.push(tag);
  }

  const tail = input.slice(last);
  if (!dropping && tail) out += cleanText(tail);
  while (open.length) out += `</${open.pop()}>`;
  return out;
}

/** Texto plano (para meta descriptions, WhatsApp, etc.). */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return decodeEntities(
    sanitizeHtml(input)
      .replace(/<(br|\/p|\/li|\/h[1-6]|\/div)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
