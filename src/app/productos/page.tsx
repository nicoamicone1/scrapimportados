import type { Metadata } from "next";

import CatalogClient from "../../components/CatalogClient";
import { getCatalogItems, getUsedCategories } from "../../lib/products";

export const metadata: Metadata = {
  title: "Productos",
  description: "Buscá y filtrá todos los productos del catálogo.",
};

export default function ProductosPage() {
  const items = getCatalogItems();
  const categories = getUsedCategories();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span
          className="h-7 w-1.5 shrink-0 rounded-full bg-accent-500"
          aria-hidden="true"
        />
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            Productos
          </h1>
          <p className="text-sm text-muted">
            {items.length} productos en el catálogo.
          </p>
        </div>
      </div>

      <CatalogClient products={items} categories={categories} />
    </div>
  );
}
