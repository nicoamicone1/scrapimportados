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
 *
 * Multi-tienda: un carrito POR TIENDA (`ecommy:cart:<storeId>` /
 * `ecommy:coupon:<storeId>` en localStorage), porque en modo fallback
 * (`/s/<slug>`) todas las tiendas comparten origen. Las claves viejas de
 * una sola tienda (`ecommy-cart-v1` / `ecommy-coupon-v1`) se migran SÓLO a
 * la tienda `demo` (la que heredó los datos de v0) la primera vez que se
 * abre; para cualquier otra tienda se ignoran.
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

const LEGACY_CART_KEY = "ecommy-cart-v1";
const LEGACY_COUPON_KEY = "ecommy-coupon-v1";
/** Tienda que hereda el carrito de v0 (una sola tienda por deploy). */
const LEGACY_STORE_SLUG = "demo";
const MAX_QTY = 999;

export function cartStorageKeys(storeId: string): { cart: string; coupon: string } {
  return { cart: `ecommy:cart:${storeId}`, coupon: `ecommy:coupon:${storeId}` };
}

interface CartState {
  items: CartItem[];
  /** Cupón validado (se revalida en el server al confirmar). */
  coupon: Coupon | null;
  /** `false` mientras no se leyó localStorage (SSR / hidratación). */
  hydrated: boolean;
}

const EMPTY: CartState = { items: [], coupon: null, hydrated: false };

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

function isCoupon(value: unknown): value is Coupon {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.type === "string" && typeof v.value === "number" && Array.isArray(v.categoryIds);
}

function readItems(key: string): CartItem[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

function readCoupon(key: string): Coupon | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCoupon(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Mueve el carrito de v0 a las claves de la tienda `demo` (una sola vez). */
function migrateLegacy(keys: { cart: string; coupon: string }) {
  try {
    const ls = window.localStorage;
    const legacyCart = ls.getItem(LEGACY_CART_KEY);
    const legacyCoupon = ls.getItem(LEGACY_COUPON_KEY);
    if (legacyCart === null && legacyCoupon === null) return;
    if (ls.getItem(keys.cart) === null && legacyCart !== null) ls.setItem(keys.cart, legacyCart);
    if (ls.getItem(keys.coupon) === null && legacyCoupon !== null) ls.setItem(keys.coupon, legacyCoupon);
    ls.removeItem(LEGACY_CART_KEY);
    ls.removeItem(LEGACY_COUPON_KEY);
  } catch {
    // Storage bloqueado: se arranca con el carrito vacío.
  }
}

/** Store externo (useSyncExternalStore) del carrito de UNA tienda. */
interface CartStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => CartState;
  setState: (items: CartItem[], coupon: Coupon | null) => void;
}

function createCartStore(storeId: string, slug: string): CartStore {
  const keys = cartStorageKeys(storeId);
  let state: CartState = EMPTY;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = (): CartState => ({ items: readItems(keys.cart), coupon: readCoupon(keys.coupon), hydrated: true });

  const getSnapshot = (): CartState => {
    if (!loaded) {
      loaded = true;
      if (slug === LEGACY_STORE_SLUG) migrateLegacy(keys);
      state = load();
    }
    return state;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Sincroniza entre pestañas (sólo las claves de esta tienda).
    const onStorage = (e: StorageEvent) => {
      if (e.key === keys.cart || e.key === keys.coupon) {
        state = load();
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const setState = (items: CartItem[], coupon: Coupon | null) => {
    // Sin ítems no tiene sentido guardar el cupón.
    const nextCoupon = items.length ? coupon : null;
    state = { items, coupon: nextCoupon, hydrated: true };
    try {
      window.localStorage.setItem(keys.cart, JSON.stringify(items));
      if (nextCoupon) window.localStorage.setItem(keys.coupon, JSON.stringify(nextCoupon));
      else window.localStorage.removeItem(keys.coupon);
    } catch {
      // Storage lleno o bloqueado: el carrito sigue en memoria.
    }
    for (const l of listeners) l();
  };

  return { subscribe, getSnapshot, setState };
}

/** Un store por tienda (se conserva al navegar entre tiendas en la misma pestaña). */
const stores = new Map<string, CartStore>();

function cartStoreFor(storeId: string, slug: string): CartStore {
  let store = stores.get(storeId);
  if (!store) {
    store = createCartStore(storeId, slug);
    stores.set(storeId, store);
  }
  return store;
}

function getServerSnapshot(): CartState {
  return EMPTY;
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

/**
 * `storeId`/`slug` identifican el carrito de la tienda. Sin ellos (vista previa
 * del admin) se usa un carrito aparte (`ecommy:cart:preview`).
 */
export function CartProvider({
  storeId = "preview",
  slug = "",
  children,
}: {
  storeId?: string;
  slug?: string;
  children: React.ReactNode;
}) {
  const store = cartStoreFor(storeId, slug);
  const { getSnapshot, setState } = store;
  const { items, coupon, hydrated } = useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);

  // El bloqueo de scroll y el foco los maneja el <Drawer> del carrito.

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const setItems = useCallback((next: CartItem[]) => setState(next, getSnapshot().coupon), [getSnapshot, setState]);

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
  }, [getSnapshot, setItems]);

  const setQty = useCallback((variantId: string, qty: number) => {
    const current = getSnapshot().items;
    setItems(
      current
        .map((i) => (i.variantId === variantId ? { ...i, qty: clampQty(qty, i.maxQty) } : i))
        .filter((i) => i.qty > 0),
    );
  }, [getSnapshot, setItems]);

  const remove = useCallback((variantId: string) => {
    setItems(getSnapshot().items.filter((i) => i.variantId !== variantId));
  }, [getSnapshot, setItems]);

  const clear = useCallback(() => setState([], null), [setState]);

  const setCoupon = useCallback((next: Coupon | null) => setState(getSnapshot().items, next), [getSnapshot, setState]);

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
  }, [getSnapshot, setItems]);

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
