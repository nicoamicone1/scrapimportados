"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { useStorePath } from "./StoreBase";

export type StoreLinkProps = ComponentProps<typeof Link>;

/**
 * `next/link` para el storefront: antepone el prefijo de la tienda
 * (`/s/<slug>` en modo fallback) a los hrefs internos, sean string o
 * `UrlObject` (`pathname`). Externos (`https:`, `mailto:`, `tel:`, `#…`,
 * `?…`) quedan igual. Idempotente: un href ya prefijado no se toca.
 *
 * Los links al admin NO van por acá: usá `platformUrl("/admin/…")`.
 */
export function StoreLink({ href, ...rest }: StoreLinkProps) {
  const toPath = useStorePath();
  const resolved =
    typeof href === "string"
      ? toPath(href)
      : href.pathname
        ? { ...href, pathname: toPath(href.pathname) }
        : href;
  return <Link href={resolved} {...rest} />;
}

export default StoreLink;
