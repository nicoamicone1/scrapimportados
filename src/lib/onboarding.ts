import "server-only";

import { DEFAULT_VARIANT_TITLE } from "@/lib/admin/variant-matrix";
import type { AdminContext } from "@/lib/auth";
import { buildOnboardingSteps, type OnboardingStep } from "@/lib/onboarding-steps";
import type { Json } from "@/lib/supabase/database.types";
import { storeDisplayHost, storeUrl } from "@/lib/tenant/urls";

export type { OnboardingStep, OnboardingStepId } from "@/lib/onboarding-steps";

/**
 * Checklist de primeros pasos (spec §14.3). La mayoría se tilda sola
 * mirando la base; `appearance` y `shared` quedan marcados en
 * `stores.onboarding` (jsonb) porque no se pueden inferir. Los textos y el
 * orden están en `onboarding-steps.ts` (puro, con tests).
 */

export type OnboardingFlag = "appearance" | "shared" | "dismissed";

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
  const [storeRow, products, variants, zones, pickups, settings, home] = await Promise.all([
    supabase.from("stores").select("onboarding").eq("id", store.id).maybeSingle(),
    supabase.from("products").select("id", head).eq("store_id", store.id).neq("status", "archived"),
    // ¿Vende con talles/colores? Basta con una variante que no sea la única por defecto.
    supabase.from("product_variants").select("id").eq("store_id", store.id).neq("title", DEFAULT_VARIANT_TITLE).limit(1),
    supabase.from("shipping_zones").select("id", head).eq("store_id", store.id).eq("is_active", true),
    supabase.from("pickup_locations").select("id", head).eq("store_id", store.id).eq("is_active", true),
    supabase.from("store_settings").select("checkout, whatsapp_phone, maintenance").eq("store_id", store.id).maybeSingle(),
    supabase.from("pages").select("status, created_at, updated_at").eq("store_id", store.id).eq("slug", "home").maybeSingle(),
  ]);

  const f = flags(storeRow.data?.onboarding ?? {});
  const checkout = flags(settings.data?.checkout ?? {});
  const transfer = flags(checkout.transfer ?? {});
  const whatsapp = flags(checkout.whatsapp ?? {});
  const maintenance = flags(settings.data?.maintenance ?? {});
  const homeEdited = Boolean(
    home.data &&
      home.data.status === "published" &&
      new Date(home.data.updated_at).getTime() - new Date(home.data.created_at).getTime() > 1000,
  );

  const steps: OnboardingStep[] = buildOnboardingSteps({
    products: products.count ?? 0,
    deliveryOptions: (zones.count ?? 0) + (pickups.count ?? 0),
    hasBank: Boolean(String(transfer.cbu ?? "").trim() || String(transfer.alias ?? "").trim()),
    hasWhatsApp: whatsapp.enabled === true && Boolean(settings.data?.whatsapp_phone),
    homeEdited,
    appearance: f.appearance === true,
    shared: f.shared === true,
    storeUrl: storeUrl(store),
    storeHost: storeDisplayHost(store),
    // Sin productos todavía (o si la consulta falla) se asume ropa: el ICP (docs/gtm/PLAN-GTM.md §3).
    variants: variants.error ? true : (variants.data?.length ?? 0) > 0 || (products.count ?? 0) === 0,
    maintenance: maintenance.enabled === true,
  });
  return { steps, completed: steps.filter((s) => s.done).length, dismissed: f.dismissed === true };
}
