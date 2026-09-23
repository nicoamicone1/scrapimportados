import { StoreLink } from "@/components/store/StoreLink";

/** Ruta de navegación (texto `--fg-muted`, el último sin link). */
export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="text-xs text-fg-muted sm:text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {item.href && i < items.length - 1 ? (
              <StoreLink href={item.href} className="hover:text-fg">
                {item.name}
              </StoreLink>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={i === items.length - 1 ? "text-fg" : undefined}>
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
