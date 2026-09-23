import { isValidElement, type ReactNode } from "react";

/*
 * Utilidades puras sobre el JSX de los artículos: texto plano (para contar
 * palabras y para los tests), títulos h2 (índice lateral) y links internos.
 * Recorren `children` y las props de texto de los componentes de artículo
 * (`ArticleTable` usa `head` y `rows`; `Callout`, `title`).
 */

const TEXT_PROPS = ["title", "head", "rows", "children"] as const;

function propsOf(node: ReactNode): Record<string, unknown> | null {
  return isValidElement(node) ? (node.props as Record<string, unknown>) : null;
}

/** Texto plano de un nodo (con espacios entre elementos). */
export function plainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((n: ReactNode) => plainText(n)).join(" ");
  const props = propsOf(node);
  if (!props) return "";
  return TEXT_PROPS.map((k) => plainText(props[k] as ReactNode)).join(" ");
}

/** Recorre todos los elementos del árbol (en orden). */
export function walkElements(node: ReactNode, visit: (type: unknown, props: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    for (const n of node as ReactNode[]) walkElements(n, visit);
    return;
  }
  const props = propsOf(node);
  if (!props || !isValidElement(node)) return;
  visit(node.type, props);
  for (const k of TEXT_PROPS) walkElements(props[k] as ReactNode, visit);
}

export interface Heading {
  id: string;
  text: string;
}

/** Títulos h2 del cuerpo, para el índice "En esta página". */
export function extractHeadings(body: ReactNode): Heading[] {
  const out: Heading[] = [];
  walkElements(body, (type, props) => {
    if (type === "h2") out.push({ id: String(props.id ?? ""), text: plainText(props.children as ReactNode).replace(/\s+/g, " ").trim() });
  });
  return out;
}

/** Todos los `href` del cuerpo. */
export function extractLinks(body: ReactNode): string[] {
  const out: string[] = [];
  walkElements(body, (_type, props) => {
    if (typeof props.href === "string") out.push(props.href);
  });
  return out;
}

const WORD = /[\p{L}\p{N}]+(?:[.,'’-][\p{L}\p{N}]+)*/gu;

export function wordCount(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/** Minutos de lectura a 200 palabras por minuto (mínimo 1). */
export function readingMinutesFor(words: number): number {
  return Math.max(1, Math.round(words / 200));
}
