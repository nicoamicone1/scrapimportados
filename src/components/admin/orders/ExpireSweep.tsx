"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { revalidateAfterExpiry } from "@/app/admin/(panel)/pedidos/actions";

/**
 * El barrido de reservas vencidas corre en el server al renderizar el
 * listado/dashboard. Si canceló pedidos, avisa y refresca la caché de
 * productos del storefront (el stock volvió), cosa que sólo puede hacer una
 * Server Action.
 */
export function ExpireSweep({ expired }: { expired: number }) {
  const done = useRef(false);
  useEffect(() => {
    if (!expired || done.current) return;
    done.current = true;
    void revalidateAfterExpiry();
    toast.info(
      expired === 1
        ? "Se canceló 1 pedido que venció sin pago y su stock volvió al inventario."
        : `Se cancelaron ${expired} pedidos que vencieron sin pago y su stock volvió al inventario.`,
    );
  }, [expired]);
  return null;
}
