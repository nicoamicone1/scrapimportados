"use client";

import { useEffect, useRef, useState } from "react";

import { checkCart } from "@/app/(store)/actions";
import { useCart } from "@/lib/cart";

/**
 * Valida el carrito (localStorage) contra la DB al entrar al carrito o al
 * checkout: aplica precios/stock actuales y devuelve los avisos.
 */
export function useCartSync(): { messages: string[]; checking: boolean; checked: boolean } {
  const { items, hydrated, applyPatches } = useCart();
  const [messages, setMessages] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!hydrated || started.current || !items.length) return;
    started.current = true;
    checkCart(items.map((i) => ({ variantId: i.variantId, name: i.name, variantTitle: i.variantTitle, unitPrice: i.unitPrice, qty: i.qty })))
      .then((res) => {
        if (res.ok) {
          applyPatches(res.data.patches);
          setMessages(res.data.messages);
        }
      })
      .catch(() => undefined)
      .finally(() => setDone(true));
  }, [hydrated, items, applyPatches]);

  const checked = hydrated && (done || !items.length);
  return { messages, checking: hydrated && !checked, checked };
}
