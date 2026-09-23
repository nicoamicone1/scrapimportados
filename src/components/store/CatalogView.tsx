import { X } from "lucide-react";
import type { ReactNode } from "react";

import { StoreLink } from "@/components/store/StoreLink";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";
import {
  catalogHref,
  hasActiveFilters,
  parseCatalogParams,
  SORT_OPTIONS,
  toggle,
  type CatalogState,
  type SearchParamsRecord,
} from "@/lib/store/catalog-params";
import { buildCategoryTree, listCategories, type CategoryNode, type StoreCategory } from "@/lib/store/categories";
import type { StoreDisplay } from "@/lib/store/display";
import {
  getOptionParamMap,
  listProducts,
  searchCatalog,
  type CatalogFacets,
  type FacetValue,
  type ProductCardData,
} from "@/lib/store/products";
import type { PublicStore } from "@/lib/tenant/resolve";
import { storePath } from "@/lib/tenant/urls";

import { Breadcrumbs } from "./Breadcrumbs";
import { FilterDrawer } from "./FilterDrawer";
import { ProductCard, ProductGrid, type ProductCardProps } from "./ProductCard";
import { SortSelect } from "./SortSelect";

interface CatalogViewProps {
  /** Path del listado dentro de la tienda, SIN prefijo (`/productos`, `/categoria/x`). */
  basePath: string;
  /** Tienda del request (`tenant.store`) y prefijo de sus links (`tenant.basePath`). */
  store: PublicStore;
  linkBase: string;
  searchParams: SearchParamsRecord;
  display: StoreDisplay;
  /** Página de categoría. */
  category?: StoreCategory | null;
  title?: string;
}

function FacetGroup({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group border-b border-border py-3" open={defaultOpen}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-fg-muted group-open:hidden">
          +
        </span>
        <span aria-hidden className="hidden text-fg-muted group-open:inline">
          −
        </span>
      </summary>
      <div className="pt-1 pb-1">{children}</div>
    </details>
  );
}

function FacetLink({ href, value, count, selected, label }: FacetValue & { href: string; label?: string }) {
  return (
    <StoreLink
      href={href}
      scroll={false}
      rel="nofollow"
      className={cn("flex min-h-9 items-center gap-2.5 text-sm", count === 0 && !selected ? "text-fg-muted" : "text-fg")}
      aria-label={`${label ?? value}${selected ? ", filtro aplicado: tocá para quitarlo" : `, ${count} productos`}`}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border",
          selected ? "border-fg bg-fg text-bg" : "border-border-strong",
        )}
      >
        {selected ? <span className="block size-1.5 rounded-[1px] bg-bg" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label ?? value}</span>
      <span className="tnum text-xs text-fg-muted">{count}</span>
    </StoreLink>
  );
}

function sumCounts(node: CategoryNode, counts: Record<string, number>): number {
  return (counts[node.id] ?? 0) + node.children.reduce((acc, c) => acc + sumCounts(c, counts), 0);
}

function FiltersPanel({
  state,
  facets,
  href,
  basePath,
  categoryLinks,
  idPrefix,
}: {
  idPrefix: string;
  state: CatalogState;
  facets: CatalogFacets;
  href: (patch: Partial<CatalogState>) => string;
  basePath: string;
  categoryLinks: { name: string; href: string; count: number; current?: boolean }[];
}) {
  const hidden: [string, string][] = [];
  if (state.q) hidden.push(["q", state.q]);
  if (state.cat) hidden.push(["cat", state.cat]);
  if (state.inStock) hidden.push(["stock", "1"]);
  for (const b of state.brands) hidden.push(["marca", b]);

  return (
    <div className="text-sm">
      {categoryLinks.length ? (
        <FacetGroup title="Categorías">
          <ul className="space-y-0.5">
            {categoryLinks.map((c) => (
              <li key={c.href}>
                <StoreLink
                  href={c.href}
                  className={cn("flex min-h-9 items-center justify-between gap-3", c.current ? "font-semibold text-fg" : "text-fg hover:underline")}
                  aria-current={c.current ? "page" : undefined}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="tnum text-xs font-normal text-fg-muted">{c.count}</span>
                </StoreLink>
              </li>
            ))}
          </ul>
        </FacetGroup>
      ) : null}

      {facets.options.map((facet) => (
        <FacetGroup key={facet.name} title={facet.name}>
          <ul className="space-y-0.5">
            {facet.values.map((v) => (
              <li key={v.value}>
                <FacetLink
                  {...v}
                  href={href({
                    page: 1,
                    options: { ...state.options, [facet.name]: toggle(state.options[facet.name] ?? [], v.value) },
                  } as Partial<CatalogState>)}
                />
              </li>
            ))}
          </ul>
        </FacetGroup>
      ))}

      {facets.brands.length ? (
        <FacetGroup title="Marca" defaultOpen={facets.brands.length <= 12 || state.brands.length > 0}>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
            {facets.brands.map((v) => (
              <li key={v.value}>
                <FacetLink {...v} href={href({ page: 1, brands: toggle(state.brands, v.value) })} />
              </li>
            ))}
          </ul>
        </FacetGroup>
      ) : null}

      {facets.price && facets.price.max > facets.price.min ? (
        <FacetGroup title="Precio">
          <form action={basePath} method="get" className="space-y-3">
            {hidden.map(([k, v], i) => (
              <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
            ))}
            {Object.entries(state.options).flatMap(([name, values]) =>
              values.map((v) => {
                const facet = facets.options.find((f) => f.name === name);
                return facet ? <input key={`${name}-${v}`} type="hidden" name={facet.param} value={v} /> : null;
              }),
            )}
            {state.sortExplicit ? <input type="hidden" name="orden" value={state.sort} /> : null}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`${idPrefix}-precio-min`} className="field-label text-xs">
                  Desde
                </label>
                <input
                  id={`${idPrefix}-precio-min`}
                  name="precio_min"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={formatMoney(Math.floor(facets.price.min))}
                  defaultValue={state.minPrice ?? ""}
                  className="input tnum"
                />
              </div>
              <div>
                <label htmlFor={`${idPrefix}-precio-max`} className="field-label text-xs">
                  Hasta
                </label>
                <input
                  id={`${idPrefix}-precio-max`}
                  name="precio_max"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={formatMoney(Math.ceil(facets.price.max))}
                  defaultValue={state.maxPrice ?? ""}
                  className="input tnum"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-secondary btn-block min-h-10">
              Aplicar precio
            </button>
          </form>
        </FacetGroup>
      ) : null}

      <div className="py-3">
        <FacetLink
          href={href({ page: 1, inStock: !state.inStock })}
          value="Sólo con stock"
          count={facets.inStockCount}
          selected={state.inStock}
        />
      </div>
    </div>
  );
}

function ActiveFilters({ state, href, clearHref, categoryName }: { state: CatalogState; href: (p: Partial<CatalogState>) => string; clearHref: string; categoryName?: string }) {
  const chips: { label: string; href: string }[] = [];
  if (state.cat && categoryName) chips.push({ label: categoryName, href: href({ page: 1, cat: "" }) });
  for (const [name, values] of Object.entries(state.options)) {
    for (const v of values) {
      chips.push({
        label: `${name}: ${v}`,
        href: href({ page: 1, options: { ...state.options, [name]: values.filter((x) => x !== v) } } as Partial<CatalogState>),
      });
    }
  }
  for (const b of state.brands) chips.push({ label: b, href: href({ page: 1, brands: state.brands.filter((x) => x !== b) }) });
  if (state.minPrice || state.maxPrice) {
    const label = [state.minPrice ? `desde ${formatMoney(state.minPrice)}` : "", state.maxPrice ? `hasta ${formatMoney(state.maxPrice)}` : ""].filter(Boolean).join(" ");
    chips.push({ label: `Precio ${label}`, href: href({ page: 1, minPrice: undefined, maxPrice: undefined }) });
  }
  if (state.inStock) chips.push({ label: "Con stock", href: href({ page: 1, inStock: false }) });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <StoreLink key={c.label} href={c.href} scroll={false} className="chip min-h-8 gap-1.5 text-xs" aria-label={`Quitar filtro ${c.label}`}>
          {c.label}
          <X className="size-3.5" aria-hidden />
        </StoreLink>
      ))}
      <StoreLink href={clearHref} className="link text-xs">
        Limpiar filtros
      </StoreLink>
    </div>
  );
}

/** Listado de productos con filtros facetados, orden y paginación (en query params). */
export async function CatalogView({ basePath, store, linkBase, searchParams, display, category, title }: CatalogViewProps) {
  const [optionParams, categories] = await Promise.all([getOptionParamMap(store.id), listCategories(store.id)]);
  const state = parseCatalogParams(searchParams, optionParams);
  const { settings } = display;
  const catFilter = category ? null : state.cat ? (categories.find((c) => c.slug === state.cat) ?? null) : null;

  const { list, facets } = await searchCatalog(store.id, {
    q: state.q,
    categoryId: category?.id ?? catFilter?.id,
    category: !category && state.cat && !catFilter ? state.cat : undefined,
    options: state.options,
    brands: state.brands,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    inStock: state.inStock,
    sort: state.sort,
    page: state.page,
    perPage: state.perPage,
    promotions: display.promotions,
    outOfStock: settings.catalog.out_of_stock_display,
  });

  const href = (patch: Partial<CatalogState>) => catalogHref(basePath, state, optionParams, patch);
  const clearHref = catalogHref(basePath, { ...state, brands: [], options: {}, minPrice: undefined, maxPrice: undefined, inStock: false, cat: "", page: 1 }, optionParams);

  // --- Categorías del panel
  const tree = buildCategoryTree(categories);
  const findNode = (nodes: CategoryNode[], id: string): CategoryNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNode(n.children, id);
      if (found) return found;
    }
    return null;
  };
  const passthrough = (slug: string) => {
    // Al cambiar de categoría se conservan búsqueda y stock; las facetas dependen de la categoría.
    const qs = new URLSearchParams();
    if (state.q) qs.set("q", state.q);
    if (state.inStock) qs.set("stock", "1");
    const s = qs.toString();
    return `/categoria/${slug}${s ? `?${s}` : ""}`;
  };
  let categoryLinks: { name: string; href: string; count: number; current?: boolean }[];
  if (category) {
    const node = findNode(tree, category.id);
    const children = node?.children ?? [];
    categoryLinks = children
      .map((c) => ({ name: c.name, href: passthrough(c.slug), count: sumCounts(c, facets.categoryCounts) }))
      .filter((c) => c.count > 0);
  } else {
    categoryLinks = tree
      .map((c) => ({ name: c.name, href: passthrough(c.slug), count: sumCounts(c, facets.categoryCounts) }))
      .filter((c) => c.count > 0);
  }

  // --- Encabezado
  const parentChain: StoreCategory[] = [];
  if (category) {
    let parent = category.parentId ? categories.find((c) => c.id === category.parentId) : undefined;
    while (parent && parentChain.length < 5) {
      parentChain.unshift(parent);
      parent = parent.parentId ? categories.find((c) => c.id === parent!.parentId) : undefined;
    }
  }
  const heading = title ?? category?.name ?? (state.q ? `Resultados para «${state.q}»` : "Todos los productos");
  const subcategories = category ? (findNode(tree, category.id)?.children ?? []) : [];
  const activeCount =
    state.brands.length + Object.values(state.options).reduce((a, v) => a + v.length, 0) + (state.minPrice || state.maxPrice ? 1 : 0) + (state.inStock ? 1 : 0) + (catFilter ? 1 : 0);

  const sortOptions = SORT_OPTIONS.filter((o) => o.value !== "relevancia" || state.q).map((o) => ({
    value: o.value,
    label: o.label,
    href: href({ sort: o.value, page: 1 }),
  }));

  const panel = (idPrefix: string) => (
    <FiltersPanel
      idPrefix={idPrefix}
      state={state}
      facets={facets}
      href={href}
      basePath={storePath(basePath, linkBase)}
      categoryLinks={categoryLinks}
    />
  );
  const cardProps = {
    promotions: display.card.promotions,
    cards: display.card.cards,
    transferPercent: display.card.transferPercent,
    transferLabel: display.card.transferLabel,
    net: display.card.net,
    whatsappPhone: display.card.whatsappPhone,
    store,
  };

  // --- Estado vacío con contenido útil (DESIGN.md §2.9)
  let empty: ReactNode = null;
  if (!list.items.length) {
    const suggestions = (await listProducts(store.id, { featured: true, perPage: 8, outOfStock: "hide" })).items;
    const fallback = suggestions.length ? suggestions : (await listProducts(store.id, { sort: "nuevos", perPage: 8, outOfStock: "hide" })).items;
    const topCats = tree.slice(0, 6);
    empty = (
      <div className="py-6">
        <p className="text-base">
          {state.q && hasActiveFilters(state)
            ? `No hay resultados para «${state.q}» con estos filtros.`
            : state.q
              ? `No encontramos «${state.q}». Probá con menos palabras o mirá estas categorías:`
              : hasActiveFilters(state)
                ? "No hay productos con estos filtros."
                : category
                  ? `Estamos cargando productos en ${category.name}.`
                  : "Todavía no hay productos publicados."}
        </p>
        {hasActiveFilters(state) ? (
          <StoreLink href={clearHref} className="btn btn-secondary mt-4">
            Limpiar filtros
          </StoreLink>
        ) : null}
        {state.q && topCats.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {topCats.map((c) => (
              <li key={c.id}>
                <StoreLink href={`/categoria/${c.slug}`} className="chip">
                  {c.name}
                </StoreLink>
              </li>
            ))}
          </ul>
        ) : null}
        {fallback.length ? (
          <section className="mt-[var(--space-section-sm)]" aria-labelledby="catalog-suggest">
            <h2 id="catalog-suggest" className="h-section mb-[calc(var(--gap-grid)*0.75+8px)]">
              {suggestions.length ? "Destacados" : "Lo más nuevo"}
            </h2>
            <div className="snap-row">
              {fallback.map((p) => (
                <ProductGridItem key={p.id} product={p} cardProps={cardProps} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  const from = (list.page - 1) * list.perPage + 1;
  const to = Math.min(list.page * list.perPage, list.total);

  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <Breadcrumbs
        items={[
          { name: "Inicio", href: "/" },
          { name: "Productos", href: "/productos" },
          ...parentChain.map((c) => ({ name: c.name, href: `/categoria/${c.slug}` })),
          ...(category ? [{ name: category.name }] : []),
        ].filter((item, i, arr) => !(item.name === "Productos" && arr.length === 2))}
      />

      <header className="mt-3 max-w-[68ch]">
        <h1 className="h-page">{heading}</h1>
        {category?.description ? <p className="mt-2 text-fg-muted">{category.description}</p> : null}
      </header>

      {subcategories.length ? (
        <nav aria-label="Subcategorías" className="no-scrollbar -mx-[var(--gutter)] mt-4 overflow-x-auto px-[var(--gutter)]">
          <ul className="flex gap-2">
            {subcategories.map((c) => (
              <li key={c.id} className="shrink-0">
                <StoreLink href={`/categoria/${c.slug}`} className="chip">
                  {c.name}
                </StoreLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <p className="tnum text-sm text-fg-muted" aria-live="polite">
          {list.total ? `${formatNumber(list.total)} ${list.total === 1 ? "producto" : "productos"}` : "Sin resultados"}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FilterDrawer activeCount={activeCount} resultCount={list.total}>
            {panel("m")}
          </FilterDrawer>
          <SortSelect options={sortOptions} value={state.sort} />
        </div>
      </div>

      <div className="mt-3">
        <ActiveFilters state={state} href={href} clearHref={clearHref} categoryName={catFilter?.name} />
      </div>

      <div className="mt-4 grid gap-8 lg:grid-cols-12">
        <aside aria-label="Filtros" className="hidden lg:col-span-3 lg:block xl:col-span-2">
          {panel("d")}
        </aside>
        <div className="min-w-0 lg:col-span-9 xl:col-span-10">
          {list.items.length ? (
            <ProductGrid
              products={list.items}
              {...cardProps}
              dividers={settings.theme.effects.dividers}
              columns={Math.max(2, settings.theme.layout.gridColumns.desktop - 1)}
            />
          ) : (
            empty
          )}

          {list.pageCount > 1 ? (
            <nav aria-label="Paginación" className="tnum mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
              <span className="text-fg-muted">
                {from}–{to} de {formatNumber(list.total)}
              </span>
              <span className="flex items-center gap-1">
                {list.page > 1 ? (
                  <StoreLink href={href({ page: list.page - 1 })} className="btn btn-secondary min-h-10" rel="prev">
                    Anterior
                  </StoreLink>
                ) : null}
                <span className="px-3 text-fg-muted">
                  Página {list.page} de {list.pageCount}
                </span>
                {list.page < list.pageCount ? (
                  <StoreLink href={href({ page: list.page + 1 })} className="btn btn-secondary min-h-10" rel="next">
                    Siguiente
                  </StoreLink>
                ) : null}
              </span>
              <span className="flex items-center gap-2 text-fg-muted">
                Ver
                {[24, 48].map((n) => (
                  <StoreLink key={n} href={href({ perPage: n, page: 1 })} aria-current={state.perPage === n ? "true" : undefined} className={cn(state.perPage === n ? "font-semibold text-fg" : "hover:text-fg")}>
                    {n}
                  </StoreLink>
                ))}
              </span>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProductGridItem({ product, cardProps }: { product: ProductCardData; cardProps: Omit<ProductCardProps, "product"> }) {
  return <ProductCard product={product} {...cardProps} sizes="(min-width: 1024px) 20vw, 45vw" />;
}
