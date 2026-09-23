import { SearchBox } from "@/components/store/SearchBox";
import { StoreLink } from "@/components/store/StoreLink";
import { buildCategoryTree, listCategories } from "@/lib/store/categories";
import { getTenant } from "@/lib/tenant/resolve";
import { platformUrl } from "@/lib/tenant/urls";

/**
 * 404 del storefront (con el tema), para productos/páginas que no existen
 * DENTRO de una tienda. Las redirecciones 301 ya se intentaron antes de
 * llegar acá: cada ruta llama `redirectIfMoved()` antes de `notFound()`.
 * (La tienda inexistente la resuelve `src/app/s/not-found.tsx`.)
 */
export default async function StoreNotFound() {
  // not-found no recibe params: la tienda sale de los headers del proxy.
  const { store } = await getTenant();
  if (!store) {
    return (
      <div className="store-container py-[var(--space-section-md)]">
        <p className="eyebrow">Error 404</p>
        <h1 className="h-page mt-1">Esta tienda no existe</h1>
        <a href={platformUrl("/")} className="btn btn-secondary mt-6">
          Ir al inicio
        </a>
      </div>
    );
  }
  const categories = buildCategoryTree(await listCategories(store.id).catch(() => [])).slice(0, 8);
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
              <StoreLink href={`/categoria/${c.slug}`} className="chip">
                {c.name}
              </StoreLink>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <StoreLink href="/productos" className="btn btn-primary">
          Ver todos los productos
        </StoreLink>
        <StoreLink href="/" className="btn btn-secondary">
          Ir al inicio
        </StoreLink>
      </div>
    </div>
  );
}
