"use client";

import { configureMoney } from "@/lib/money";

/**
 * Fija la moneda activa del módulo `money` en el cliente (para `roundPrice`
 * en el carrito). Se renderiza arriba de todo en el layout del storefront.
 */
export default function ConfigureMoney({ currency }: { currency: string }) {
  configureMoney(currency);
  return null;
}
