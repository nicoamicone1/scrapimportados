import Link from "next/link";

/** Encabezado de sección: barrita de acento + título + link opcional. */
export default function SectionHeader({
  title,
  href,
  linkLabel = "Ver todos →",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  /** Controles extra a la derecha (ej. "Ver todas" de categorías). */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-ink sm:text-lg">
        <span
          className="h-5 w-1.5 shrink-0 rounded-full bg-accent-500"
          aria-hidden="true"
        />
        {title}
      </h2>

      <div className="flex shrink-0 items-center gap-3">
        {children}
        {href && (
          <Link
            href={href}
            className="whitespace-nowrap text-xs font-bold text-brand-700 underline-offset-4 transition hover:text-brand-900 hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
