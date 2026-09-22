import "server-only";

import { cookies } from "next/headers";

import { bestPaymentDiscount, type Promotion } from "@/lib/pricing";
import { PRESETS, type Theme } from "@/lib/theme";

import { getPaymentMethods, type StorePaymentMethod } from "./payment-methods";
import { getActivePromotions } from "./promotions";
import { getSettings, type StoreSettings } from "./settings";
import { getPickupLocations, getShippingZones, type StorePickupLocation, type StoreShippingZone } from "./shipping";

/**
 * Contexto de display de precios para cards, ficha, carrito y checkout
 * (todo cacheado). Los bloques del builder pueden pasar `cardDisplay` a
 * `<ProductCard {...cardDisplay} />` para mostrar lo mismo que el listado.
 */
export interface NetPriceDisplay {
  defaultVat: number;
  label: string;
}

export interface CardDisplay {
  promotions: Promotion[];
  cards: Theme["cards"];
  /** % del mejor método con descuento (0 si no hay o si el tema lo oculta). */
  transferPercent: number;
  /** Nombre del método ("transferencia"), para "$ X con transferencia". */
  transferLabel: string;
  /** Precio sin impuestos nacionales (null = no se muestra). */
  net: NetPriceDisplay | null;
  /** Teléfono para "Consultar por WhatsApp" en agotados (null si el método no está activo). */
  whatsappPhone: string | null;
}

export interface StoreDisplay {
  settings: StoreSettings;
  paymentMethods: StorePaymentMethod[];
  promotions: Promotion[];
  zones: StoreShippingZone[];
  pickups: StorePickupLocation[];
  card: CardDisplay;
  /** Umbral de la barra de envío gratis (null = no se muestra). */
  freeShippingThreshold: number | null;
  /** true si el umbral sale de las zonas (y no aplica a todas). */
  freeShippingPartial: boolean;
}

export function transferLabelFor(name: string): string {
  return /transfer/i.test(name) ? "transferencia" : name.toLowerCase();
}

/**
 * SÓLO EN DESARROLLO: la cookie `ecommy_dev_theme=<preset>` pisa el preset del
 * tema y `ecommy_dev_net=1` activa el precio neto, para probar sin tocar
 * `store_settings` (que es compartido). En producción no hace nada.
 */
async function devThemeOverride(settings: StoreSettings): Promise<StoreSettings> {
  if (process.env.NODE_ENV !== "development") return settings;
  try {
    const jar = await cookies();
    const id = jar.get("ecommy_dev_theme")?.value;
    let out = settings;
    if (id && id in PRESETS) out = { ...out, theme: PRESETS[id as keyof typeof PRESETS] };
    // `ecommy_dev_net=1`: fuerza el precio sin impuestos nacionales para revisarlo.
    if (jar.get("ecommy_dev_net")?.value === "1") out = { ...out, tax: { ...out.tax, show_net_price: true } };
    return out;
  } catch {
    // fuera de un request (build): sin override
  }
  return settings;
}

export async function getStoreDisplay(): Promise<StoreDisplay> {
  const [rawSettings, paymentMethods, promotions, zones, pickups] = await Promise.all([
    getSettings(),
    getPaymentMethods(),
    getActivePromotions(),
    getShippingZones(),
    getPickupLocations(),
  ]);
  const settings = await devThemeOverride(rawSettings);
  const best = bestPaymentDiscount(paymentMethods);
  const cards = settings.theme.cards;
  const hasWhatsapp = paymentMethods.some((m) => m.type === "whatsapp") && Boolean(settings.whatsapp_phone);

  let freeShippingThreshold: number | null = null;
  let freeShippingPartial = false;
  if (settings.free_shipping_bar.enabled) {
    if (settings.free_shipping_bar.threshold) freeShippingThreshold = settings.free_shipping_bar.threshold;
    else {
      const withFree = zones.filter((z) => z.freeOver !== null && z.freeOver > 0);
      if (withFree.length) {
        freeShippingThreshold = Math.min(...withFree.map((z) => z.freeOver as number));
        freeShippingPartial = withFree.length < zones.length || zones.some((z) => z.freeOver !== freeShippingThreshold);
      }
    }
  }

  return {
    settings,
    paymentMethods,
    promotions,
    zones,
    pickups,
    card: {
      promotions,
      cards,
      transferPercent: best && cards.showTransferPrice ? best.discountPercent : 0,
      transferLabel: best ? transferLabelFor(best.name) : "transferencia",
      net:
        settings.tax.show_net_price && cards.showNetPrice
          ? { defaultVat: settings.tax.default_vat_percent, label: settings.tax.label }
          : null,
      whatsappPhone: hasWhatsapp ? settings.whatsapp_phone : null,
    },
    freeShippingThreshold,
    freeShippingPartial,
  };
}
