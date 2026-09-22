import { escapeHtml, isSafeUrl, sanitizeHtml } from "@/lib/html";

/**
 * Markdown MÍNIMO y seguro → HTML (políticas de la tienda, instrucciones de
 * pago). Soporta: `#`/`##`/`###`, párrafos, saltos de línea, `**negrita**`,
 * `*itálica*`/`_itálica_`, `[link](url)`, listas `-`/`*`/`1.`, `> cita`,
 * `---`. Todo el texto se escapa ANTES de aplicar el formato y el resultado
 * pasa además por `sanitizeHtml` (defensa en profundidad).
 */

function inline(text: string): string {
  let out = escapeHtml(text);
  // Links: [texto](url) — sólo URLs seguras; si no, queda el texto.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const decoded = url.replace(/&amp;/g, "&");
    if (!isSafeUrl(decoded)) return label;
    const external = /^https?:\/\//i.test(decoded);
    return `<a href="${escapeHtml(decoded)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^\w])_([^_\s][^_]*)_(?=[^\w]|$)/g, "$1<em>$2</em>");
  return out;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "h"; level: 2 | 3 | 4; text: string }
  | { kind: "hr" };

export function markdownToHtml(markdown: string | null | undefined): string {
  if (!markdown?.trim()) return "";
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flush();
      // Un "#" del markdown es un h2 en la página (el h1 es el título).
      blocks.push({ kind: "h", level: (heading[1].length + 1) as 2 | 3 | 4, text: heading[2] });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush();
      blocks.push({ kind: "hr" });
      continue;
    }
    const ul = /^[-*+]\s+(.+)$/.exec(trimmed);
    const ol = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      const c = current as Block | null;
      if (c && c.kind === kind) c.items.push((ul ?? ol)![1]);
      else {
        flush();
        current = { kind, items: [(ul ?? ol)![1]] };
      }
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      const c = current as Block | null;
      if (c && c.kind === "quote") c.lines.push(quote[1]);
      else {
        flush();
        current = { kind: "quote", lines: [quote[1]] };
      }
      continue;
    }
    const c = current as Block | null;
    if (c && c.kind === "p") c.lines.push(trimmed);
    else if (c && (c.kind === "ul" || c.kind === "ol") && /^\s{2,}/.test(line)) {
      // Continuación de un ítem de lista (línea indentada).
      c.items[c.items.length - 1] += ` ${trimmed}`;
    } else {
      flush();
      current = { kind: "p", lines: [trimmed] };
    }
  }
  flush();

  const html = blocks
    .map((b) => {
      switch (b.kind) {
        case "h":
          return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
        case "hr":
          return "<hr>";
        case "p":
          return `<p>${b.lines.map(inline).join("<br>")}</p>`;
        case "quote":
          return `<blockquote><p>${b.lines.map(inline).join("<br>")}</p></blockquote>`;
        case "ul":
        case "ol":
          return `<${b.kind}>${b.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${b.kind}>`;
      }
    })
    .join("\n");
  return sanitizeHtml(html);
}

/** Markdown → texto plano de una línea (para metadescripciones). */
export function markdownToText(markdown: string | null | undefined, max = 160): string {
  const text = (markdown ?? "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
