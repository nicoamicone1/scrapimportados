"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Rutas que siguen visibles en mantenimiento: el cliente tiene que poder ver su pedido y los legales. */
const ALLOWED = [/^\/pedido\//, /^\/arrepentimiento/, /^\/politicas\//];

/**
 * Modo mantenimiento (`store_settings.maintenance`): muestra el aviso en vez
 * del contenido, salvo en pedido/legales. El layout no lo monta para admins.
 */
export function MaintenanceGate({ storeName, message, children }: { storeName: string; message: string; children: ReactNode }) {
  const pathname = usePathname();
  if (ALLOWED.some((re) => re.test(pathname))) return <>{children}</>;
  return (
    <div className="store-container flex min-h-[60vh] flex-col justify-center py-[var(--space-section-lg)]">
      <p className="eyebrow">{storeName}</p>
      <h1 className="h-page mt-2 max-w-[20ch]">Volvemos en un rato</h1>
      <p className="mt-3 max-w-[56ch] text-fg-muted">{message || "Estamos haciendo mejoras en la tienda."}</p>
    </div>
  );
}
