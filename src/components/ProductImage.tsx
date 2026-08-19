/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

type Props = {
  src: string | null;
  alt: string;
  className?: string;
  /** `true` para la imagen grande del detalle (carga inmediata). */
  priority?: boolean;
};

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-tint text-brand-200">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        className="h-10 w-10"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L16 17" />
        <path d="m14 15 1.8-1.8a2 2 0 0 1 2.8 0L21 15.5" />
      </svg>
      <span className="sr-only">Sin imagen</span>
    </div>
  );
}

/**
 * Imagen del proveedor con placeholder si falta o si falla la carga.
 * Se usa `<img>` (no `next/image`) porque el sitio es export estático y
 * las URLs son de un dominio externo arbitrario.
 */
export default function ProductImage({ src, alt, className = "", priority = false }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <Placeholder />;

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`h-full w-full object-contain ${className}`}
    />
  );
}
