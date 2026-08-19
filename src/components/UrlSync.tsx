"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Sincroniza `?q=` y `?cat=` con el estado de los filtros, en las dos
 * direcciones (URL -> estado al entrar / navegar, estado -> URL al filtrar).
 *
 * No renderiza nada: vive dentro de un `<Suspense>` porque `useSearchParams()`
 * lo exige en el export estático (durante el prerender no hay query string).
 */
export default function UrlSync({
  query,
  category,
  onParams,
}: {
  query: string;
  category: string;
  /** Debe ser estable (useCallback) para no re-disparar los efectos. */
  onParams: (query: string, category: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const qParam = (searchParams.get("q") ?? "").trim();
  const catParam = searchParams.get("cat") ?? "todas";

  const urlKey = `${qParam}|${catParam}`;
  const stateKey = `${query.trim()}|${category}`;

  /** Última combinación ya aplicada, para no rebotar entre los dos efectos. */
  const applied = useRef<string | null>(null);
  const mounted = useRef(false);

  // URL -> estado
  useEffect(() => {
    if (applied.current === urlKey) return;
    applied.current = urlKey;
    onParams(qParam, catParam);
  }, [urlKey, qParam, catParam, onParams]);

  // Estado -> URL (nunca en el primer render: al entrar manda la URL)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (applied.current === stateKey) return;
    applied.current = stateKey;

    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set("q", q);
    if (category !== "todas") params.set("cat", category);
    const qs = params.toString();

    router.replace(qs ? `/productos/?${qs}` : "/productos/", { scroll: false });
  }, [stateKey, query, category, router]);

  return null;
}
