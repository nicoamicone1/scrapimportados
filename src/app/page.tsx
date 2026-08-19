import Link from "next/link";

import CategoryGrid from "../components/CategoryGrid";
import ProductSlider from "../components/ProductSlider";
import { whatsappLink } from "../lib/config";
import { HOME_SLIDERS, itemsForSlider } from "../lib/home";
import {
  getCatalogItems,
  getUsedCategories,
  isSampleData,
  type Category,
} from "../lib/products";

/** Categorías ordenadas por cantidad de productos (las más grandes primero). */
function byPopularity(categories: Category[], items: ReturnType<typeof getCatalogItems>) {
  const counts = new Map<string, number>();
  for (const p of items) {
    for (const c of p.categories) {
      counts.set(c.slug, (counts.get(c.slug) ?? 0) + 1);
    }
  }
  return [...categories].sort(
    (a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0),
  );
}

export default function Home() {
  const items = getCatalogItems();
  const categories = byPopularity(getUsedCategories(), items);
  const usingSample = isSampleData();

  const sliders = HOME_SLIDERS.map((slider) => ({
    ...slider,
    items: itemsForSlider(items, slider),
  }));

  const waUrl = whatsappLink("Hola! Quiero hacer una consulta sobre el catálogo.");

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden bg-linear-to-br from-brand-800 via-brand-700 to-brand-500 px-5 py-8 text-white sm:mx-0 sm:rounded-3xl sm:px-10 sm:py-12">
        <span
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-500/30 blur-3xl"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-brand-300/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative max-w-2xl">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset ring-white/25">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" aria-hidden="true" />
            {items.length} productos con stock actualizado
          </p>

          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Tecnología y hogar al mejor precio
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">
            Pedí por WhatsApp, te respondemos al toque.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="/productos/"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-800 shadow-sm transition hover:bg-accent-50 active:scale-[0.98]"
            >
              Ver catálogo
            </Link>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 0 1 12 4zm-3.4 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.2.2 1.8 2.9 4.5 4 2.2.9 2.7.7 3.2.7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.2.1-1.3l-.6-.3s-1.4-.7-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.7-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.5l-.8-1.9c-.2-.5-.4-.5-.6-.5z" />
              </svg>
              Escribinos
            </a>
          </div>
        </div>
      </section>

      {usingSample && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Estás viendo datos de ejemplo (<code>data/products.sample.json</code>).
          Ejecutá <code className="font-semibold">npm run scrape</code> para
          generar <code>data/products.json</code>.
        </p>
      )}

      <CategoryGrid categories={categories} />

      {/* Sliders: alternan una banda de fondo tenue. */}
      {sliders.map((slider, i) => (
        <ProductSlider
          key={slider.title}
          title={slider.title}
          href={slider.href}
          items={slider.items}
          band={i % 2 === 0}
        />
      ))}
    </div>
  );
}
