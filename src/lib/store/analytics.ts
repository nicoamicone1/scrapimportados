/**
 * Eventos estándar de e-commerce (P0-18). `track()` despacha a GA4 (`gtag`),
 * GTM (`dataLayer`) y Meta Pixel (`fbq`) si están cargados; si no hay
 * ninguno configurado no hace nada. Sólo client.
 */

export type TrackEventName = "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "search" | "view_item_list";

export interface TrackItem {
  item_id: string;
  item_name: string;
  item_variant?: string | null;
  item_brand?: string | null;
  price: number;
  quantity: number;
}

export interface TrackPayload {
  currency?: string;
  value?: number;
  items?: TrackItem[];
  transaction_id?: string;
  shipping?: number;
  coupon?: string | null;
  search_term?: string;
}

type Fn = (...args: unknown[]) => void;

interface TrackWindow {
  gtag?: Fn;
  fbq?: Fn;
  dataLayer?: unknown[];
  __ecommyGa4?: boolean;
  __ecommyGtm?: boolean;
}

const META_EVENTS: Record<TrackEventName, string | null> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  search: "Search",
  view_item_list: null,
};

export function track(event: TrackEventName, payload: TrackPayload = {}): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as TrackWindow;
  const data = { currency: "ARS", ...payload };
  try {
    if (w.__ecommyGa4 && typeof w.gtag === "function") w.gtag("event", event, data);
    if (w.__ecommyGtm && Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ ecommerce: null });
      w.dataLayer.push({ event, ecommerce: data });
    }
    const meta = META_EVENTS[event];
    if (meta && typeof w.fbq === "function") {
      w.fbq("track", meta, {
        currency: data.currency,
        value: data.value,
        content_type: "product",
        content_ids: data.items?.map((i) => i.item_id),
        contents: data.items?.map((i) => ({ id: i.item_id, quantity: i.quantity, item_price: i.price })),
        num_items: data.items?.reduce((acc, i) => acc + i.quantity, 0),
        ...(event === "search" ? { search_string: data.search_term } : {}),
      });
    }
  } catch {
    // Un bloqueador de anuncios no puede romper la compra.
  }
}

/** `track` una sola vez por clave (ej. `purchase` por pedido), recordado en el navegador. */
export function trackOnce(key: string, event: TrackEventName, payload: TrackPayload = {}): void {
  if (typeof window === "undefined") return;
  const storageKey = `ecommy-tracked:${key}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, "1");
  } catch {
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Sin storage: se trackea igual (mejor duplicado que perdido).
    }
  }
  track(event, payload);
}
