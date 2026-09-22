"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/money";

export interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  /** Nombre del parámetro (default `page`). */
  param?: string;
  className?: string;
}

/** "1–50 de 312" + anterior/siguiente, conservando el resto de los query params. */
export function Pagination({ page, perPage, total, param = "page", className }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const href = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete(param);
    else params.set(param, String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const btn =
    "inline-flex h-8 items-center gap-1 rounded-adm border border-adm-input-border bg-adm-surface px-2.5 text-sm text-adm-fg hover:bg-adm-hover";
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Paginación" className={cn("flex items-center justify-between gap-4 py-3", className)}>
      <p className="tnum text-[13px] text-adm-fg-muted">
        {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(btn, page <= 1 && disabled)}
          scroll={false}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </Link>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= pageCount}
          tabIndex={page >= pageCount ? -1 : undefined}
          className={cn(btn, page >= pageCount && disabled)}
          scroll={false}
        >
          Siguiente
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
