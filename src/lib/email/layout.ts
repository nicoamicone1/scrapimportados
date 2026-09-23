import { escapeHtml } from "@/lib/html";

/**
 * Maquetado de emails (puro, sin dependencias de server).
 *
 * Las plantillas describen el mail como una lista de bloques y este módulo
 * los convierte a la vez en HTML robusto (tablas, estilos inline, 600 px,
 * fuente del sistema, sin imágenes obligatorias) y en texto plano completo.
 * Así el HTML y el texto nunca se desincronizan.
 *
 * Estética (docs/DESIGN.md §1): recibo sobrio. Tinta sobre blanco, reglas
 * finas, un único color de acento (el `primary` de la tienda o el verde-tinta
 * de Ecommy) sólo en el filete superior y en el botón. Sin gradientes, sin
 * sombras, sin íconos decorativos.
 */

// ---------------------------------------------------------------------------
// Paleta (espejo de los tokens --adm-* de src/app/admin/admin.css)
// ---------------------------------------------------------------------------

export const INK = "#1c1917";
export const INK_MUTED = "#6b6860";
export const RULE = "#e2dbcd";
export const PAPER = "#ffffff";
export const CANVAS = "#efeae1";
export const PLATFORM_ACCENT = "#2e4a3f";
export const PLATFORM_ACCENT_TEXT = "#ffffff";

// Comillas simples: estas pilas van dentro de atributos style="…" (una doble los cortaría).
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

export interface Brand {
  name: string;
  /** Home de la tienda / de la plataforma (link del encabezado). */
  url: string | null;
  /** Logo (sólo https). Si no carga, se ve el `alt` con el nombre. */
  logoUrl: string | null;
  accent: string;
  accentText: string;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Acento validado (hex): nunca se inyecta otra cosa en un `style`. */
export function brandColors(primary?: string | null, primaryText?: string | null): { accent: string; accentText: string } {
  if (primary && HEX.test(primary)) {
    return { accent: primary, accentText: primaryText && HEX.test(primaryText) ? primaryText : "#ffffff" };
  }
  return { accent: INK, accentText: "#ffffff" };
}

/** URL apta para un `href`/`src` de email: sólo http(s), mailto y tel. */
export function safeHref(url: string | null | undefined): string | null {
  const v = (url ?? "").trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------

/** Texto en línea: texto plano, negrita o link. */
export type Inline = string | { b: string } | { href: string; label: string } | { mono: string };

export interface Row {
  label: string;
  value: string;
  /** Números de cuenta, códigos: monoespaciada. */
  mono?: boolean;
}

export interface LineItem {
  name: string;
  detail?: string | null;
  amount: string;
}

export type Block =
  | { t: "heading"; text: string }
  | { t: "p"; content: Inline | Inline[]; muted?: boolean }
  | { t: "section"; title: string }
  | { t: "button"; href: string; label: string }
  | { t: "rows"; rows: Row[] }
  | { t: "items"; items: LineItem[] }
  | { t: "totals"; rows: { label: string; value: string; strong?: boolean }[] }
  | { t: "list"; ordered?: boolean; items: (Inline | Inline[])[] }
  | { t: "box"; blocks: Block[] }
  | { t: "rule" };

export interface EmailDocument {
  subject: string;
  /** Resumen que muestran los clientes de correo al lado del asunto. */
  preheader: string;
  brand: Brand;
  /** Los falsy (`false`, `null`, `""`) se ignoran: permite `cond && bloque`. */
  blocks: (Block | null | false | undefined | "")[];
  /** Pie: por qué recibís el mail y cómo contactar. */
  footer: (Inline | Inline[])[];
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const esc = escapeHtml;

function inlineHtml(content: Inline | Inline[], linkColor = INK): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((part) => {
      if (typeof part === "string") return esc(part);
      if ("b" in part) return `<strong style="font-weight:600;color:${INK};">${esc(part.b)}</strong>`;
      if ("mono" in part) return `<span style="font-family:${MONO};">${esc(part.mono)}</span>`;
      const href = safeHref(part.href);
      return href
        ? `<a href="${esc(href)}" style="color:${linkColor};text-decoration:underline;">${esc(part.label)}</a>`
        : esc(part.label);
    })
    .join("");
}

function inlineText(content: Inline | Inline[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if ("b" in part) return part.b;
      if ("mono" in part) return part.mono;
      const href = safeHref(part.href);
      if (!href) return part.label;
      const shown = href.replace(/^mailto:/i, "");
      return shown === part.label ? part.label : `${part.label} (${shown})`;
    })
    .join("");
}

const P = `margin:0 0 16px;font-size:15px;line-height:1.55;color:${INK};`;
const CELL = `padding:8px 0;border-bottom:1px solid ${RULE};font-size:14px;line-height:1.4;vertical-align:top;`;

function blockHtml(block: Block, brand: Brand): string {
  switch (block.t) {
    case "heading":
      return `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;font-weight:600;color:${INK};">${esc(block.text)}</h1>`;
    case "p":
      return `<p style="${P}${block.muted ? `color:${INK_MUTED};font-size:14px;` : ""}">${inlineHtml(block.content)}</p>`;
    case "section":
      return `<h2 style="margin:28px 0 8px;font-size:15px;line-height:1.3;font-weight:600;color:${INK};">${esc(block.title)}</h2>`;
    case "button": {
      const href = safeHref(block.href);
      if (!href) return "";
      return (
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>` +
        `<td style="background:${brand.accent};border-radius:4px;">` +
        `<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:${brand.accentText};text-decoration:none;border-radius:4px;">${esc(block.label)}</a>` +
        `</td></tr></table>`
      );
    }
    case "rows": {
      const rows = block.rows.filter((r) => r.value);
      if (!rows.length) return "";
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-top:1px solid ${RULE};">` +
        rows
          .map(
            (r) =>
              `<tr><td style="${CELL}color:${INK_MUTED};width:34%;padding-right:12px;">${esc(r.label)}</td>` +
              `<td style="${CELL}color:${INK};text-align:right;word-break:break-all;${r.mono ? `font-family:${MONO};font-size:13px;` : ""}">${esc(r.value)}</td></tr>`,
          )
          .join("") +
        `</table>`
      );
    }
    case "items":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-top:1px solid ${RULE};">` +
        block.items
          .map(
            (i) =>
              `<tr><td style="${CELL}color:${INK};padding-right:12px;">${esc(i.name)}` +
              (i.detail ? `<br><span style="font-size:13px;color:${INK_MUTED};">${esc(i.detail)}</span>` : "") +
              `</td><td style="${CELL}color:${INK};text-align:right;white-space:nowrap;">${esc(i.amount)}</td></tr>`,
          )
          .join("") +
        `</table>`
      );
    case "totals":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">` +
        block.rows
          .map((r) => {
            const top = r.strong ? `border-top:1px solid ${INK};padding-top:10px;` : "";
            const weight = r.strong ? "font-weight:600;font-size:16px;" : `font-size:14px;`;
            const color = r.strong ? INK : INK_MUTED;
            return (
              `<tr><td style="padding:4px 12px 4px 0;${top}${weight}color:${color};">${esc(r.label)}</td>` +
              `<td style="padding:4px 0;${top}${weight}color:${INK};text-align:right;white-space:nowrap;">${esc(r.value)}</td></tr>`
            );
          })
          .join("") +
        `</table>`
      );
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return (
        `<${tag} style="margin:0 0 16px;padding:0 0 0 22px;color:${INK};">` +
        block.items.map((i) => `<li style="margin:0 0 8px;font-size:15px;line-height:1.5;">${inlineHtml(i)}</li>`).join("") +
        `</${tag}>`
      );
    }
    case "box":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border:1px solid ${RULE};border-radius:4px;">` +
        `<tr><td class="em-box" style="padding:20px 20px 4px;">${block.blocks
          .map((b, i) => {
            const html = blockHtml(b, brand);
            // El título de la caja va pegado al borde superior.
            return i === 0 && b.t === "section" ? html.replace("margin:28px 0 8px", "margin:0 0 8px") : html;
          })
          .join("")}</td></tr></table>`
      );
    case "rule":
      return `<hr style="border:0;border-top:1px solid ${RULE};margin:24px 0;">`;
  }
}

function blockText(block: Block): string {
  switch (block.t) {
    case "heading":
      return `${block.text}\n${"=".repeat(Math.min(block.text.length, 60))}`;
    case "p":
      return inlineText(block.content);
    case "section":
      return `${block.title.toUpperCase()}`;
    case "button": {
      const href = safeHref(block.href);
      return href ? `${block.label}: ${href}` : "";
    }
    case "rows":
      return block.rows
        .filter((r) => r.value)
        .map((r) => `${r.label}: ${r.value}`)
        .join("\n");
    case "items":
      return block.items.map((i) => `- ${i.name}${i.detail ? ` (${i.detail})` : ""}: ${i.amount}`).join("\n");
    case "totals":
      return block.rows.map((r) => (r.strong ? `${r.label.toUpperCase()}: ${r.value}` : `${r.label}: ${r.value}`)).join("\n");
    case "list":
      return block.items.map((i, n) => `${block.ordered ? `${n + 1}.` : "-"} ${inlineText(i)}`).join("\n");
    case "box":
      return ["----------", ...block.blocks.map(blockText).filter(Boolean), "----------"].join("\n\n");
    case "rule":
      return "----------";
  }
}

function headerHtml(brand: Brand): string {
  const logo = safeHref(brand.logoUrl);
  const inner = logo?.startsWith("https://")
    ? `<img src="${esc(logo)}" alt="${esc(brand.name)}" height="40" style="display:block;height:40px;width:auto;max-width:220px;border:0;outline:none;font-family:${FONT};font-size:18px;font-weight:600;color:${INK};">`
    : `<span style="font-size:18px;line-height:1.2;font-weight:600;color:${INK};">${esc(brand.name)}</span>`;
  const href = safeHref(brand.url);
  return href ? `<a href="${esc(href)}" style="text-decoration:none;color:${INK};">${inner}</a>` : inner;
}

/** Arma el HTML y el texto de un email a partir de sus bloques. */
export function renderEmail(doc: EmailDocument): EmailContent {
  const blocks = doc.blocks.filter((b): b is Block => Boolean(b));
  const body = blocks.map((b) => blockHtml(b, doc.brand)).join("");
  const footer = doc.footer
    .map((line) => `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${INK_MUTED};">${inlineHtml(line, INK_MUTED)}</p>`)
    .join("");

  const html =
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">` +
    `<title>${esc(doc.subject)}</title>` +
    // Celulares (los clientes que no leen <style> quedan con los paddings de escritorio).
    `<style>@media (max-width:480px){.em-outer{padding:12px 8px !important}.em-pad{padding-left:16px !important;padding-right:16px !important}.em-box{padding:16px 14px 4px !important}}</style>` +
    `</head>` +
    `<body style="margin:0;padding:0;background:${CANVAS};font-family:${FONT};color:${INK};-webkit-text-size-adjust:100%;">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CANVAS};font-size:1px;line-height:1px;">${esc(doc.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">` +
    `<tr><td class="em-outer" align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${PAPER};border:1px solid ${RULE};border-top:3px solid ${doc.brand.accent};font-family:${FONT};">` +
    `<tr><td class="em-pad" style="padding:24px 32px 8px;">${headerHtml(doc.brand)}</td></tr>` +
    `<tr><td class="em-pad" style="padding:16px 32px 16px;">${body}</td></tr>` +
    `<tr><td class="em-pad" style="padding:20px 32px 24px;border-top:1px solid ${RULE};">${footer}</td></tr>` +
    `</table></td></tr></table></body></html>`;

  const text = [
    doc.brand.name,
    "",
    ...blocks
      .map(blockText)
      .filter(Boolean)
      .flatMap((t) => [t, ""]),
    "--",
    ...doc.footer.map(inlineText),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { subject: doc.subject, html, text: `${text}\n` };
}
