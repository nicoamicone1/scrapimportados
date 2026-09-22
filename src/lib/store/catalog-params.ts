/**
 * Estado del listado en query params compartibles (puro):
 *   ?q=  &orden=  &pagina=  &por=24|48  &marca=… (repetible)
 *   &precio_min= &precio_max=  &stock=1  &cat=<slug>  &<opción>=<valor> (repetible, ej. talle=M&talle=L)
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export const SORT_OPTIONS = [
  { value: "relevancia", label: "Relevancia" },
  { value: "nuevos", label: "Más nuevos" },
  { value: "precio-asc", label: "Menor precio" },
  { value: "precio-desc", label: "Mayor precio" },
  { value: "nombre", label: "Nombre (A–Z)" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const PER_PAGE_OPTIONS = [24, 48] as const;

export interface CatalogState {
  q: string;
  sort: SortValue;
  /** El orden vino explícito en la URL. */
  sortExplicit: boolean;
  page: number;
  perPage: number;
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  cat: string;
  /** Nombre de opción → valores. */
  options: Record<string, string[]>;
}

function all(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => x.trim()).filter(Boolean).slice(0, 30);
}

function one(v: string | string[] | undefined): string {
  return all(v)[0] ?? "";
}

function price(v: string | string[] | undefined): number | undefined {
  const n = Number(one(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseCatalogParams(params: SearchParamsRecord, optionParams: Map<string, string>): CatalogState {
  const q = one(params.q).slice(0, 100);
  const rawSort = one(params.orden);
  const sortExplicit = SORT_OPTIONS.some((s) => s.value === rawSort);
  const sort: SortValue = sortExplicit ? (rawSort as SortValue) : q ? "relevancia" : "nuevos";
  const perRaw = Number(one(params.por));
  const options: Record<string, string[]> = {};
  for (const [param, name] of optionParams) {
    const values = all(params[param]);
    if (values.length) options[name] = values;
  }
  return {
    q,
    sort: sort === "relevancia" && !q ? "nuevos" : sort,
    sortExplicit,
    page: Math.max(1, Math.floor(Number(one(params.pagina) || one(params.page)) || 1)),
    perPage: (PER_PAGE_OPTIONS as readonly number[]).includes(perRaw) ? perRaw : 24,
    brands: all(params.marca),
    minPrice: price(params.precio_min),
    maxPrice: price(params.precio_max),
    inStock: one(params.stock) === "1",
    cat: one(params.cat),
    options,
  };
}

/** Serializa el estado (sin defaults) a query string, aplicando un parche. */
export function catalogHref(
  basePath: string,
  state: CatalogState,
  optionParams: Map<string, string>,
  patch: Partial<Omit<CatalogState, "options">> & { options?: Record<string, string[]> } = {},
): string {
  const next = { ...state, ...patch, options: patch.options ?? state.options };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.cat) qs.set("cat", next.cat);
  const nameToParam = new Map([...optionParams].map(([param, name]) => [name, param]));
  for (const [name, values] of Object.entries(next.options)) {
    const param = nameToParam.get(name);
    if (param) for (const v of values) qs.append(param, v);
  }
  for (const b of next.brands) qs.append("marca", b);
  if (next.minPrice) qs.set("precio_min", String(next.minPrice));
  if (next.maxPrice) qs.set("precio_max", String(next.maxPrice));
  if (next.inStock) qs.set("stock", "1");
  const defaultSort = next.q ? "relevancia" : "nuevos";
  if (next.sort !== defaultSort) qs.set("orden", next.sort);
  if (next.perPage !== 24) qs.set("por", String(next.perPage));
  if (next.page > 1) qs.set("pagina", String(next.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Alterna un valor en una lista (para facetas). */
export function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function hasActiveFilters(state: CatalogState): boolean {
  return Boolean(
    state.brands.length || state.minPrice || state.maxPrice || state.inStock || Object.keys(state.options).length || state.cat,
  );
}
