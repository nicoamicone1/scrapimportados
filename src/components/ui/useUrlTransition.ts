"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, createElement, useCallback, useContext, useMemo, useTransition, type ReactNode, type TransitionStartFunction } from "react";

/*
 * Transiciones de URL con estado pendiente compartido (spec §14.5).
 *
 * - `useUrlTransition()` devuelve `{ pending, replace, push, setParams, startTransition }`.
 *   `setParams({ q: "remera", page: null })` reescribe la query (null/"" borra)
 *   y por defecto resetea `?page`.
 * - Dentro de un `<UrlPendingScope>` (el AdminShell envuelve cada página) el
 *   `pending` es COMPARTIDO: los filtros lo disparan y las `<Table>` de la
 *   página muestran el overlay "cargando" hasta que llega el resultado.
 * - Fuera de un scope (storefront) funciona igual con un pending local.
 */

interface UrlPendingContextValue {
  pending: boolean;
  startTransition: TransitionStartFunction;
}

const UrlPendingContext = createContext<UrlPendingContextValue | null>(null);

/** Provee un `pending` compartido para todos los filtros y tablas de adentro. */
export function UrlPendingScope({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const value = useMemo(() => ({ pending, startTransition }), [pending]);
  return createElement(UrlPendingContext.Provider, { value }, children);
}

/** `pending` del scope más cercano (false si no hay scope). */
export function useUrlPending(): boolean {
  return useContext(UrlPendingContext)?.pending ?? false;
}

export type ParamsPatch = Record<string, string | number | null | undefined>;

export interface SetParamsOptions {
  /** Borra `?page` (default true: cambiar un filtro vuelve a la página 1). */
  resetPage?: boolean;
  /** `push` en lugar de `replace` (default false). */
  push?: boolean;
  /** Scroll al tope (default false). */
  scroll?: boolean;
}

export function useUrlTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = useContext(UrlPendingContext);
  const [localPending, localStart] = useTransition();
  const startTransition = scope?.startTransition ?? localStart;
  const pending = scope ? scope.pending : localPending;

  const toHref = useCallback(
    (params: URLSearchParams | string) => {
      const qs = typeof params === "string" ? params.replace(/^\?/, "") : params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname],
  );

  /** `router.replace` dentro de una transición (acepta URLSearchParams, query o href). */
  const replace = useCallback(
    (target: URLSearchParams | string, opts: { scroll?: boolean } = {}) => {
      const href = typeof target === "string" && target.startsWith("/") ? target : toHref(target);
      startTransition(() => router.replace(href, { scroll: opts.scroll ?? false }));
    },
    [router, startTransition, toHref],
  );

  const push = useCallback(
    (target: URLSearchParams | string, opts: { scroll?: boolean } = {}) => {
      const href = typeof target === "string" && target.startsWith("/") ? target : toHref(target);
      startTransition(() => router.push(href, { scroll: opts.scroll ?? false }));
    },
    [router, startTransition, toHref],
  );

  /** Aplica un parche a la query actual. */
  const setParams = useCallback(
    (patch: ParamsPatch, opts: SetParamsOptions = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") params.delete(k);
        else params.set(k, String(v));
      }
      if (opts.resetPage ?? true) params.delete("page");
      const href = toHref(params);
      startTransition(() =>
        opts.push ? router.push(href, { scroll: opts.scroll ?? false }) : router.replace(href, { scroll: opts.scroll ?? false }),
      );
    },
    [router, searchParams, startTransition, toHref],
  );

  return { pending, replace, push, setParams, startTransition, searchParams, pathname };
}
