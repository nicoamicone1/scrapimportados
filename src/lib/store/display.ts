import "server-only";

import { cookies, headers } from "next/headers";

import { bestPaymentDiscount, type Promotion } from "@/lib/pricing";
import { LUNA_ANNOUNCEMENT, LUNA_DESIGN_ID, LUNA_FAVICON_URL, LUNA_LOGO_LIGHT_URL, LUNA_LOGO_URL, LUNA_THEME } from "@/lib/showcase/luna";
import { isDarkTheme, parseTheme, PRESETS, type Theme } from "@/lib/theme";

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
  /** Cuotas sin interés para "3 cuotas sin interés de $ X" (0 = no se muestra; sólo con Mercado Pago conectado). */
  freeInstallments: number;
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

/** Tienda cuya portada se puede ver con cualquier preset (`?estilo=`, ver `src/proxy.ts`). */
export const PREVIEW_STORE_SLUG = "demo";

const DEV_THEME_COOKIE = "ecommy_dev_theme";

/**
 * SÓLO EN DESARROLLO: ¿la tienda `demo` se ve con el diseño a medida de Luna
 * (cookie `ecommy_dev_theme=luna`)? Muestra lo que la tienda va a tener
 * después de `scripts/seed-demo-ropa.mts` (tema, logo, favicon, anuncio,
 * menús, imágenes de categoría y portada) sin escribir en la base. En
 * producción siempre es `false`. Lo usan `getStoreDisplay` y la portada y el
 * layout de `/s/[store]` (docs/DEMO-ROPA.md).
 */
export async function isLunaDevPreview(): Promise<boolean> {
  if (process.env.NODE_ENV !== "development") return false;
  try {
    const [jar, h] = await Promise.all([cookies(), headers()]);
    return jar.get(DEV_THEME_COOKIE)?.value === LUNA_DESIGN_ID && h.get("x-store-slug") === PREVIEW_STORE_SLUG;
  } catch {
    // fuera de un request (build): sin vista previa
    return false;
  }
}

/**
 * SÓLO EN DESARROLLO: la cookie `ecommy_dev_theme=<preset>` pisa el preset del
 * tema (`luna` en la tienda demo: el diseño a medida completo, ver
 * `isLunaDevPreview`) y `ecommy_dev_net=1` activa el precio neto, para probar
 * sin tocar `store_settings` (que es compartido). En producción no hace nada.
 */
async function devThemeOverride(settings: StoreSettings): Promise<StoreSettings> {
  if (process.env.NODE_ENV !== "development") return settings;
  try {
    const jar = await cookies();
    const id = jar.get(DEV_THEME_COOKIE)?.value;
    let out = settings;
    if (id && id in PRESETS) out = { ...out, theme: PRESETS[id as keyof typeof PRESETS] };
    else if (await isLunaDevPreview()) {
      out = {
        ...out,
        theme: LUNA_THEME,
        logo_url: LUNA_LOGO_URL,
        favicon_url: LUNA_FAVICON_URL,
        announcement: LUNA_ANNOUNCEMENT,
      };
    }
    // `ecommy_dev_net=1`: fuerza el precio sin impuestos nacionales para revisarlo.
    if (jar.get("ecommy_dev_net")?.value === "1") out = { ...out, tax: { ...out.tax, show_net_price: true } };
    return out;
  } catch {
    // fuera de un request (build): sin override
  }
  return settings;
}

/**
 * Vista previa por preset (sólo la tienda demo, en cualquier entorno): el proxy
 * pasa `x-store-preview-style` cuando la URL trae `?estilo=<preset>` (o la
 * cookie de sesión que deja). Pisa el tema completo con el del preset, salvo el
 * crédito del pie, que no es estilo. Nunca escribe en la base.
 */
async function previewThemeOverride(settings: StoreSettings): Promise<StoreSettings> {
  try {
    const h = await headers();
    if (h.get("x-store-slug") !== PREVIEW_STORE_SLUG) return settings;
    const id = h.get("x-store-preview-style");
    if (!id || !Object.hasOwn(PRESETS, id)) return settings;
    const preset = PRESETS[id as keyof typeof PRESETS];
    // El logo de Luna es tinta: sobre un estilo oscuro va su versión en crema.
    const logo = settings.logo_url === LUNA_LOGO_URL && isDarkTheme(preset) ? LUNA_LOGO_LIGHT_URL : settings.logo_url;
    return { ...settings, logo_url: logo, theme: { ...preset, footer: { ...preset.footer, showCredit: settings.theme.footer.showCredit } } };
  } catch {
    return settings;
  }
}

export async function getStoreDisplay(storeId: string): Promise<StoreDisplay> {
  const [rawSettings, paymentMethods, promotions, zones, pickups] = await Promise.all([
    getSettings(storeId),
    getPaymentMethods(storeId),
    getActivePromotions(storeId),
    getShippingZones(storeId),
    getPickupLocations(storeId),
  ]);
  // `parseTheme` otra vez: la caché de settings puede traer un tema serializado
  // antes de que el schema sumara campos (theme.style.*); así nunca falta uno.
  const normalized = { ...rawSettings, theme: parseTheme(rawSettings.theme) };
  const settings = await previewThemeOverride(await devThemeOverride(normalized));
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
      freeInstallments: paymentMethods.some((m) => m.type === "mercadopago")
        ? Math.min(settings.checkout.mercadopago.free_installments, settings.checkout.mercadopago.max_installments)
        : 0,
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
