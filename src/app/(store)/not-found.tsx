import Link from "next/link";

import { SearchBox } from "@/components/store/SearchBox";
import { buildCategoryTree, listCategories } from "@/lib/store/categories";

/**
 * 404 del storefront (con el tema). Las redirecciones 301 ya se intentaron
 * antes de llegar acá: cada ruta llama `redirectIfMoved()` antes de `notFound()`.
 */
export default async function StoreNotFound() {
  const categories = buildCategoryTree(await listCategories().catch(() => [])).slice(0, 8);
  return (
    <div className="store-container py-[var(--space-section-md)]">
      <p className="eyebrow">Error 404</p>
      <h1 className="h-page mt-1">No encontramos esta página</h1>
      <p className="mt-2 max-w-[56ch] text-fg-muted">Puede que el producto ya no esté publicado o que el link tenga un error. Probá buscarlo:</p>
      <SearchBox className="mt-5 max-w-[480px]" />
      {categories.length ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/categoria/${c.slug}`} className="chip">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/productos" className="btn btn-primary">
          Ver todos los productos
        </Link>
        <Link href="/" className="btn btn-secondary">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
