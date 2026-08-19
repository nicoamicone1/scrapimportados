"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface CartItem {
  id: number;
  slug: string;
  name: string;
  sku: string;
  image: string | null;
  /** Precios FINALES (con markup). El `base` del proveedor nunca llega acá. */
  priceEfectivo: number;
  priceWeb: number | null;
  qty: number;
}

/** Producto mínimo que se puede agregar al carrito (lo cumple `CatalogItem`). */
export type Addable = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  image: string | null;
  prices: {
    efectivo: { final: number };
    web: { final: number } | null;
  };
};

export type PaymentMethod = "efectivo" | "web";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  web: "Precio web",
};

/* ------------------------------------------------------------------ */
/* Store externo con persistencia en localStorage                      */
/*                                                                     */
/* Se usa `useSyncExternalStore`: durante el prerender / la hidratación */
/* el snapshot es el vacío, así que no hay mismatch, y el contenido     */
/* real aparece recién cuando el navegador puede leer localStorage.     */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "carrito";
const PAYMENT_KEY = "carrito-pago";

interface CartState {
  items: CartItem[];
  payment: PaymentMethod;
  /** `false` mientras no se leyó localStorage (prerender / hidratación). */
  hydrated: boolean;
}

const EMPTY: CartState = { items: [], payment: "efectivo", hydrated: false };

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.slug === "string" &&
    typeof v.name === "string" &&
    typeof v.priceEfectivo === "number" &&
    typeof v.qty === "number" &&
    v.qty > 0
  );
}

function readItems(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

function readPayment(): PaymentMethod {
  try {
    const raw = window.localStorage.getItem(PAYMENT_KEY);
    return raw === "web" || raw === "efectivo" ? raw : "efectivo";
  } catch {
    return "efectivo";
  }
}

function persist(next: CartState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.items));
    window.localStorage.setItem(PAYMENT_KEY, next.payment);
  } catch {
    /* storage lleno o bloqueado: el carrito sigue funcionando en memoria */
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot del cliente: la primera lectura carga localStorage. */
function getSnapshot(): CartState {
  if (!loaded) {
    loaded = true;
    state = { items: readItems(), payment: readPayment(), hydrated: true };
  }
  return state;
}

/** Snapshot del servidor / prerender: siempre vacío. */
function getServerSnapshot(): CartState {
  return EMPTY;
}

function update(patch: Partial<Omit<CartState, "hydrated">>) {
  state = { ...getSnapshot(), ...patch };
  persist(state);
  for (const listener of listeners) listener();
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

interface CartContextValue extends CartState {
  count: number;
  total: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  setPayment: (payment: PaymentMethod) => void;
  add: (product: Addable, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  /** Precio unitario según la forma de pago elegida. */
  unitPrice: (item: CartItem) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { items, payment, hydrated } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [isOpen, setIsOpen] = useState(false);

  // El drawer abierto bloquea el scroll del body.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const setPayment = useCallback((next: PaymentMethod) => {
    update({ payment: next });
  }, []);

  const add = useCallback((product: Addable, qty = 1) => {
    const current = getSnapshot().items;
    const found = current.find((i) => i.id === product.id);
    update({
      items: found
        ? current.map((i) =>
            i.id === product.id ? { ...i, qty: i.qty + qty } : i,
          )
        : [
            ...current,
            {
              id: product.id,
              slug: product.slug,
              name: product.name,
              sku: product.sku,
              image: product.image,
              priceEfectivo: product.prices.efectivo.final,
              priceWeb: product.prices.web ? product.prices.web.final : null,
              qty,
            },
          ],
    });
  }, []);

  const setQty = useCallback((id: number, qty: number) => {
    const current = getSnapshot().items;
    update({
      items:
        qty <= 0
          ? current.filter((i) => i.id !== id)
          : current.map((i) => (i.id === id ? { ...i, qty } : i)),
    });
  }, []);

  const remove = useCallback((id: number) => {
    update({ items: getSnapshot().items.filter((i) => i.id !== id) });
  }, []);

  const clear = useCallback(() => update({ items: [] }), []);

  const unitPrice = useCallback(
    (item: CartItem) =>
      payment === "web" && item.priceWeb != null
        ? item.priceWeb
        : item.priceEfectivo,
    [payment],
  );

  const count = useMemo(() => items.reduce((acc, i) => acc + i.qty, 0), [items]);

  const total = useMemo(
    () => items.reduce((acc, i) => acc + unitPrice(i) * i.qty, 0),
    [items, unitPrice],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      payment,
      hydrated,
      count,
      total,
      isOpen,
      openCart,
      closeCart,
      setPayment,
      add,
      setQty,
      remove,
      clear,
      unitPrice,
    }),
    [
      items,
      payment,
      hydrated,
      count,
      total,
      isOpen,
      openCart,
      closeCart,
      setPayment,
      add,
      setQty,
      remove,
      clear,
      unitPrice,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
