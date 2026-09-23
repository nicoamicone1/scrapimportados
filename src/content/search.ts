/*
 * Búsqueda del centro de ayuda (client-side, sin backend): filtra por
 * título y descripción, sin distinguir mayúsculas ni tildes, y exige que
 * aparezcan todas las palabras. Los que coinciden en el título van primero.
 */

export interface HelpSearchItem {
  slug: string;
  title: string;
  description: string;
  section: string;
  readingMinutes: number;
}

export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

export function searchHelp<T extends Pick<HelpSearchItem, "title" | "description">>(items: readonly T[], query: string): T[] {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const title = normalizeSearch(item.title);
    const haystack = `${title} ${normalizeSearch(item.description)}`;
    if (!tokens.every((t) => haystack.includes(t))) return;
    const score = tokens.filter((t) => title.includes(t)).length;
    scored.push({ item, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.item);
}
