import { orderHereMessage } from "@/components/admin/share/messages";

/**
 * Pasos del checklist de primeros pasos (puro: lo usa `onboarding.ts` y se
 * prueba sin base). El orden sigue a quien vende por Instagram y WhatsApp
 * (docs/gtm/PLAN-GTM.md §10): productos → cobros → compartir el link, que
 * es lo que trae el primer pedido; envíos, apariencia e inicio después.
 */

export type OnboardingStepId = "products" | "appearance" | "shipping" | "payments" | "home" | "shared";

export const ONBOARDING_ORDER: readonly OnboardingStepId[] = ["products", "payments", "shared", "shipping", "appearance", "home"];

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  /** Texto listo para la historia o el estado (sólo en "Compartí el link"). */
  shareText?: string;
}

export interface OnboardingFacts {
  /** Productos no archivados. */
  products: number;
  /** Zonas de envío y puntos de retiro activos. */
  deliveryOptions: number;
  /** CBU o alias para transferencias. */
  hasBank: boolean;
  /** Pago a acordar por WhatsApp, con número. */
  hasWhatsApp: boolean;
  homeEdited: boolean;
  /** Pasos que se marcan a mano (`stores.onboarding`). */
  appearance: boolean;
  shared: boolean;
  /** URL absoluta de la tienda y cómo se muestra (`tienda-luna.ecommy.app`). */
  storeUrl: string;
  storeHost: string;
  /** Hay productos con talles, colores u otras opciones. */
  variants: boolean;
  /** Modo mantenimiento: la tienda no muestra el catálogo. */
  maintenance: boolean;
}

function shareDescription(f: OnboardingFacts): string {
  if (f.maintenance) {
    return `Tu tienda está en ${f.storeHost}, pero en modo mantenimiento: quien entra ve el aviso en lugar del catálogo. Desactivalo desde Compartir y pasá el link en una historia.`;
  }
  return `Tu tienda ya está publicada en ${f.storeHost}: no hay que activar nada. Pasá el link en una historia de Instagram o en tu estado de WhatsApp con este texto.`;
}

export function buildOnboardingSteps(f: OnboardingFacts): OnboardingStep[] {
  const steps: Record<OnboardingStepId, OnboardingStep> = {
    products: {
      id: "products",
      title: "Cargá tu primer producto",
      description: "Con foto, precio y stock. También podés importar desde una planilla.",
      href: "/admin/productos/nuevo",
      cta: "Cargar producto",
      done: f.products >= 1,
    },
    payments: {
      id: "payments",
      title: "Definí cómo cobrás",
      description: "CBU o alias para transferencias, o el WhatsApp para acordar el pago.",
      href: "/admin/configuracion/pagos",
      cta: "Configurar pagos",
      done: f.hasBank || f.hasWhatsApp,
    },
    shared: {
      id: "shared",
      title: "Compartí el link de tu tienda",
      description: shareDescription(f),
      // Con mantenimiento, /admin/compartir avisa y lleva a desactivarlo.
      href: "/admin/compartir",
      cta: "Ver link, QR y mensajes",
      done: f.shared,
      shareText: orderHereMessage(f.storeUrl, { variants: f.variants }),
    },
    shipping: {
      id: "shipping",
      title: "Configurá los envíos",
      description: "Zonas con su costo, o un punto de retiro.",
      href: "/admin/envios",
      cta: "Configurar envíos",
      done: f.deliveryOptions >= 1,
    },
    appearance: {
      id: "appearance",
      title: "Personalizá la apariencia",
      description: "Colores, tipografías y logo. Elegimos un estilo según tu rubro; ajustalo a tu marca.",
      href: "/admin/apariencia",
      cta: "Abrir apariencia",
      done: f.appearance,
    },
    home: {
      id: "home",
      title: "Ajustá tu página de inicio",
      description: "Portada, destacados y textos. Publicá cuando te guste.",
      href: "/admin/paginas",
      cta: "Editar inicio",
      done: f.homeEdited,
    },
  };
  return ONBOARDING_ORDER.map((id) => steps[id]);
}
