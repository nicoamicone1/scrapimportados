"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Drawer } from "./Drawer";

/** Botón "Filtrar" + drawer con los filtros (mobile/tablet). Al aplicar un filtro, cierra. */
export function FilterDrawer({ children, activeCount, resultCount }: { children: ReactNode; activeCount: number; resultCount: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search.toString()}`;
  const [lastKey, setLastKey] = useState(key);
  // Cada navegación (filtro aplicado) cierra el drawer.
  if (key !== lastKey) {
    setLastKey(key);
    if (open) setOpen(false);
  }

  return (
    <>
      <button type="button" className="btn btn-secondary min-h-10 lg:hidden" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontal className="size-4" aria-hidden strokeWidth={1.5} />
        Filtrar{activeCount ? ` (${activeCount})` : ""}
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros"
        side="left"
        footer={
          <button type="button" className="btn btn-solid btn-block" onClick={() => setOpen(false)}>
            Ver {resultCount} {resultCount === 1 ? "producto" : "productos"}
          </button>
        }
      >
        <div className="px-4 py-2 sm:px-5">{children}</div>
      </Drawer>
    </>
  );
}
