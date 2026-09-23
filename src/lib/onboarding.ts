import "server-only";

import type { AdminContext } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Checklist de primeros pasos (spec §14.3). La mayoría se tilda sola
 * mirando la base; `appearance` y `shared` quedan marcados en
 * `stores.onboarding` (jsonb) porque no se pueden inferir.
 */

export type OnboardingStepId = "products" | "appearance" | "shipping" | "payments" | "home" | "shared";
export type OnboardingFlag = "appearance" | "shared" | "dismissed";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
}

function flags(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Marca un paso manual en `stores.onboarding` (no rompe la action si falla). */
export async function markOnboarding(ctx: Pick<AdminContext, "supabase" | "store">, flag: OnboardingFlag): Promise<void> {
  const { data } = await ctx.supabase.from("stores").select("onboarding").eq("id", ctx.store.id).maybeSingle();
  const current = flags(data?.onboarding ?? {});
  if (current[flag] === true) return;
  const { error } = await ctx.supabase
    .from("stores")
    .update({ onboarding: { ...current, [flag]: true } })
    .eq("id", ctx.store.id);
  if (error) console.error("[onboarding]", error.message);
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completed: number;
  dismissed: boolean;
}

export async function getOnboardingStatus(ctx: Pick<AdminContext, "supabase" | "store">): Promise<OnboardingStatus> {
  const { supabase, store } = ctx;
  const head = { count: "exact" as const, head: true };
  const [storeRow, products, zones, pickups, settings, home] = await Promise.all([
    supabase.from("stores").select("onboarding").eq("id", store.id).maybeSingle(),
    supabase.from("products").select("id", head).eq("store_id", store.id).neq("status", "archived"),
    supabase.from("shipping_zones").select("id", head).eq("store_id", store.id).eq("is_active", true),
    supabase.from("pickup_locations").select("id", head).eq("store_id", store.id).eq("is_active", true),
    supabase.from("store_settings").select("checkout, whatsapp_phone").eq("store_id", store.id).maybeSingle(),
    supabase.from("pages").select("status, created_at, updated_at").eq("store_id", store.id).eq("slug", "home").maybeSingle(),
  ]);

  const f = flags(storeRow.data?.onboarding ?? {});
  const checkout = flags(settings.data?.checkout ?? {});
  const transfer = flags(checkout.transfer ?? {});
  const whatsapp = flags(checkout.whatsapp ?? {});
  const hasBank = Boolean(String(transfer.cbu ?? "").trim() || String(transfer.alias ?? "").trim());
  const hasWhatsApp = whatsapp.enabled === true && Boolean(settings.data?.whatsapp_phone);
  const homeEdited = Boolean(
    home.data &&
      home.data.status === "published" &&
      new Date(home.data.updated_at).getTime() - new Date(home.data.created_at).getTime() > 1000,
  );

  const steps: OnboardingStep[] = [
    {
      id: "products",
      title: "Cargá tu primer producto",
      description: "Con foto, precio y stock. También podés importar desde una planilla.",
      href: "/admin/productos/nuevo",
      cta: "Cargar producto",
      done: (products.count ?? 0) >= 1,
    },
    {
      id: "appearance",
      title: "Personalizá la apariencia",
      description: "Colores, tipografías y logo. Elegimos un estilo según tu rubro; ajustalo a tu marca.",
      href: "/admin/apariencia",
      cta: "Abrir apariencia",
      done: f.appearance === true,
    },
    {
      id: "shipping",
      title: "Configurá los envíos",
      description: "Zonas con su costo, o un punto de retiro.",
      href: "/admin/envios",
      cta: "Configurar envíos",
      done: (zones.count ?? 0) + (pickups.count ?? 0) >= 1,
    },
    {
      id: "payments",
      title: "Definí cómo cobrás",
      description: "CBU o alias para transferencias, o el WhatsApp para acordar el pago.",
      href: "/admin/configuracion/pagos",
      cta: "Configurar pagos",
      done: hasBank || hasWhatsApp,
    },
    {
      id: "home",
      title: "Ajustá tu página de inicio",
      description: "Portada, destacados y textos. Publicá cuando te guste.",
      href: "/admin/paginas",
      cta: "Editar inicio",
      done: homeEdited,
    },
    {
      id: "shared",
      title: "Compartí el link de tu tienda",
      description: "Mandalo por WhatsApp o ponelo en tu Instagram.",
      href: "/admin",
      cta: "Copiar link",
      done: f.shared === true,
    },
  ];
  return { steps, completed: steps.filter((s) => s.done).length, dismissed: f.dismissed === true };
}
