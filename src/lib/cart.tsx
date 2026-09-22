"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { Coupon } from "@/lib/pricing";

/**
 * Carrito del storefront (client, localStorage). Ítems POR VARIANTE.
 *
 * Guarda el precio de LISTA (`unitPrice`). Los precios finales (promos,
 * cupón, método de pago, envío) se calculan con `computeCart()` de
 * `src/lib/pricing` para mostrar y se recalculan en el server al confirmar.
 */

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  /** null para la variante "Default". */
  variantTitle: string | null;
  sku: string | null;
  image: string | null;
  /** Precio de lista de la variante al momento de agregar. */
  unitPrice: number;
  qty: number;
  /** Para promos/cupones por categoría. */
  categoryIds?: string[];
  /** Tope por stock (si se controla). */
  maxQty?: number | null;
  /** Precio tachado propio de la variante (para el motor de precios). */
  compareAtPrice?: number | null;
  /** Alícuota de IVA del producto (null = default de la tienda), para el precio sin impuestos. */
  vatPercent?: number | null;
}

/** Parche de validación contra la DB (`qty: 0` = quitar). */
export interface CartItemPatch {
  variantId: string;
  qty: number;
  unitPrice: number;
  maxQty: number | null;
  name?: string;
  variantTitle?: string | null;
  sku?: string | null;
  image?: string | null;
  slug?: string;
  categoryIds?: string[];
  vatPercent?: number | null;
}

export type AddableItem = Omit<CartItem, "qty">;

const STORAGE_KEY = "ecommy-cart-v1";
const COUPON_KEY = "ecommy-coupon-v1";
const MAX_QTY = 999;

interface CartState {
  items: CartItem[];
  /** Cupón validado (se revalida en el server al confirmar). */
  coupon: Coupon | null;
  /** `false` mientras no se leyó localStorage (SSR / hidratación). */
  hydrated: boolean;
}

const EMPTY: CartState = { items: [], coupon: null, hydrated: false };

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.variantId === "string" &&
    typeof v.productId === "string" &&
    typeof v.slug === "string" &&
    typeof v.name === "string" &&
    typeof v.unitPrice === "number" &&
    typeof v.qty === "number" &&
    v.qty > 0
  );
}

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

function isCoupon(value: unknown): value is Coupon {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.type === "string" && typeof v.value === "number" && Array.isArray(v.categoryIds);
}

function readCoupon(): Coupon | null {
  try {
    const raw = window.localStorage.getItem(COUPON_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCoupon(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persist(items: CartItem[], coupon: Coupon | null) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    if (coupon) window.localStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
    else window.localStorage.removeItem(COUPON_KEY);
  } catch {
    // Storage lleno o bloqueado: el carrito sigue en memoria.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Sincroniza entre pestañas.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === COUPON_KEY) {
      state = { items: read(), coupon: readCoupon(), hydrated: true };
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): CartState {
  if (!loaded) {
    loaded = true;
    state = { items: read(), coupon: readCoupon(), hydrated: true };
  }
  return state;
}

function getServerSnapshot(): CartState {
  return EMPTY;
}

function setState(items: CartItem[], coupon: Coupon | null) {
  // Sin ítems no tiene sentido guardar el cupón.
  const nextCoupon = items.length ? coupon : null;
  state = { items, coupon: nextCoupon, hydrated: true };
  persist(items, nextCoupon);
  for (const l of listeners) l();
}

function setItems(items: CartItem[]) {
  setState(items, getSnapshot().coupon);
}

function clampQty(qty: number, max?: number | null) {
  const limit = max != null && max > 0 ? Math.min(max, MAX_QTY) : MAX_QTY;
  return Math.max(0, Math.min(Math.floor(qty), limit));
}

interface CartContextValue {
  items: CartItem[];
  hydrated: boolean;
  /** Cantidad total de unidades. */
  count: number;
  /** Σ unitPrice × qty (precio de lista, sin promos). */
  listSubtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: AddableItem, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  coupon: Coupon | null;
  setCoupon: (coupon: Coupon | null) => void;
  /** Aplica la validación contra la DB (precios, stock, quitados). */
  applyPatches: (patches: CartItemPatch[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { items, coupon, hydrated } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);

  // El bloqueo de scroll y el foco los maneja el <Drawer> del carrito.

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const add = useCallback((item: AddableItem, qty = 1) => {
    const current = getSnapshot().items;
    const found = current.find((i) => i.variantId === item.variantId);
    setItems(
      found
        ? current.map((i) =>
            i.variantId === item.variantId
              ? { ...i, ...item, qty: clampQty(i.qty + qty, item.maxQty ?? i.maxQty) }
              : i,
          )
        : [...current, { ...item, qty: clampQty(qty, item.maxQty) }].filter((i) => i.qty > 0),
    );
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    const current = getSnapshot().items;
    setItems(
      current
        .map((i) => (i.variantId === variantId ? { ...i, qty: clampQty(qty, i.maxQty) } : i))
        .filter((i) => i.qty > 0),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setItems(getSnapshot().items.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setState([], null), []);

  const setCoupon = useCallback((next: Coupon | null) => setState(getSnapshot().items, next), []);

  const applyPatches = useCallback((patches: CartItemPatch[]) => {
    const byId = new Map(patches.map((p) => [p.variantId, p]));
    const next = getSnapshot()
      .items.map((item) => {
        const p = byId.get(item.variantId);
        if (!p) return item;
        return {
          ...item,
          qty: clampQty(p.qty, p.maxQty),
          unitPrice: p.unitPrice,
          maxQty: p.maxQty,
          name: p.name || item.name,
          variantTitle: p.variantTitle !== undefined ? p.variantTitle : item.variantTitle,
          sku: p.sku !== undefined ? p.sku : item.sku,
          image: p.image !== undefined && p.image !== null ? p.image : item.image,
          slug: p.slug || item.slug,
          categoryIds: p.categoryIds ?? item.categoryIds,
          vatPercent: p.vatPercent !== undefined ? p.vatPercent : item.vatPercent,
        };
      })
      .filter((i) => i.qty > 0);
    setItems(next);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      count: items.reduce((acc, i) => acc + i.qty, 0),
      listSubtotal: items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0),
      isOpen,
      open,
      close,
      add,
      setQty,
      remove,
      clear,
      coupon,
      setCoupon,
      applyPatches,
    }),
    [items, hydrated, isOpen, open, close, add, setQty, remove, clear, coupon, setCoupon, applyPatches],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
