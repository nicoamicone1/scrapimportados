"use client";

import { useState } from "react";

import ProductImage from "./ProductImage";

export default function Gallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="aspect-square overflow-hidden rounded-3xl border border-line bg-tint p-5 shadow-card">
        <ProductImage src={current} alt={alt} priority />
      </div>

      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={i === active}
                className={[
                  "aspect-square w-full overflow-hidden rounded-xl border bg-white p-1 transition",
                  i === active
                    ? "border-brand-500 ring-2 ring-brand-500/25"
                    : "border-line hover:border-brand-300",
                ].join(" ")}
              >
                <ProductImage src={src} alt={`${alt} — imagen ${i + 1}`} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
