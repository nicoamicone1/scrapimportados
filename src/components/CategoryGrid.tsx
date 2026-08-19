"use client";

import Link from "next/link";
import { useState } from "react";

import type { Category } from "../lib/products";
import CategoryIcon from "./CategoryIcon";
import SectionHeader from "./SectionHeader";

/** Cuántas categorías se muestran antes del "Ver todas". */
const PROMINENT = 12;

/**
 * Tintes de los iconos. Se eligen por posición (determinista, así el HTML
 * estático y la hidratación coinciden) para que la grilla tenga color sin
 * necesidad de guardar nada por categoría.
 */
const TINTS = [
  "bg-brand-100 text-brand-700",
  "bg-accent-100 text-accent-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
];

export default function CategoryGrid({
  categories,
}: {
  categories: Category[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? categories : categories.slice(0, PROMINENT);
  const rest = categories.length - shown.length;

  if (categories.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Categorías">
        {categories.length > PROMINENT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="whitespace-nowrap text-xs font-bold text-brand-700 underline-offset-4 transition hover:text-brand-900 hover:underline"
          >
            {expanded ? "Ver menos" : `Ver todas (+${rest})`}
          </button>
        )}
      </SectionHeader>

      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((c, i) => (
          <li key={c.slug}>
            <Link
              href={`/productos/?cat=${encodeURIComponent(c.slug)}`}
              className="group flex h-full flex-col items-center justify-start gap-2 rounded-2xl border border-line bg-surface px-2 py-3.5 text-center shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105 ${TINTS[i % TINTS.length]}`}
              >
                <CategoryIcon slug={c.slug} name={c.name} className="h-6 w-6" />
              </span>
              <span className="text-[11px] font-semibold leading-tight text-ink-soft">
                {c.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
