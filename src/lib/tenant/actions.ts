"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { ADMIN_STORE_COOKIE, ADMIN_STORE_COOKIE_OPTIONS, getProfile, getSession, listMyStores } from "@/lib/auth";

import { storeSlugProblem, STORE_SLUG_MESSAGES } from "./slug";

const idSchema = z.string().uuid();

/**
 * Cambia la tienda activa del admin (cookie `ecommy_admin_store`). Valida
 * que el usuario sea miembro activo (o superadmin: "entrar como").
 */
export async function setActiveStore(storeId: string): Promise<ActionResult<{ storeId: string }>> {
  return runAction(async () => {
    const parsed = idSchema.safeParse(storeId);
    if (!parsed.success) return fail("Tienda inválida.");
    const { supabase, user } = await getSession();
    if (!user) return fail("Iniciá sesión de nuevo.");

    const mine = (await listMyStores()).find((s) => s.id === parsed.data);
    if (mine && !mine.is_active) return fail("Tu acceso a esa tienda está pausado.");
    if (!mine) {
      const profile = await getProfile();
      if (!profile?.is_platform_admin) return fail("No tenés acceso a esa tienda.");
      const { data } = await supabase.from("stores").select("id").eq("id", parsed.data).neq("status", "deleted").maybeSingle();
      if (!data) return fail("La tienda no existe.");
    }
    (await cookies()).set(ADMIN_STORE_COOKIE, parsed.data, ADMIN_STORE_COOKIE_OPTIONS);
    return ok({ storeId: parsed.data });
  });
}

export type SlugCheck = { available: true } | { available: false; message: string };

/** Disponibilidad de un slug en vivo (wizard de alta). */
export async function checkStoreSlug(slug: string): Promise<SlugCheck> {
  const clean = String(slug ?? "").trim().toLowerCase();
  const problem = storeSlugProblem(clean);
  if (problem) return { available: false, message: STORE_SLUG_MESSAGES[problem] };
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("check_store_slug", { p_slug: clean });
  if (error) {
    console.error("[tenant] check_store_slug:", error.message);
    return { available: false, message: "No pudimos verificar la dirección. Probá de nuevo." };
  }
  return data ? { available: true } : { available: false, message: STORE_SLUG_MESSAGES.taken };
}
