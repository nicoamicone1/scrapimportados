"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { ADMIN_STORE_COOKIE, ADMIN_STORE_COOKIE_OPTIONS, getSession } from "@/lib/auth";
import { notifyStoreCreated } from "@/lib/email/notify";
import { setActiveStore } from "@/lib/tenant/actions";
import { createStoreSchema, type CreateStoreInput } from "@/lib/tenant/create-store";
import { STORE_SLUG_MESSAGES } from "@/lib/tenant/slug";

/** "Entrar al panel" desde /app: fija la tienda activa y va a /admin. */
export async function enterStore(formData: FormData): Promise<void> {
  const id = String(formData.get("storeId") ?? "");
  const res = await setActiveStore(id);
  if (!res.ok) redirect(`/app?error=${encodeURIComponent(res.error)}`);
  redirect("/admin");
}

/** Paso final del wizard: `create_store()` + tienda activa. */
export async function createStore(input: CreateStoreInput): Promise<ActionResult<{ storeId: string; slug: string }>> {
  return runAction(async () => {
    const parsed = createStoreSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const { supabase, user } = await getSession();
    if (!user) return fail("Tu sesión venció. Ingresá de nuevo.");

    const { data: storeId, error } = await supabase.rpc("create_store", {
      p_name: v.name,
      p_slug: v.slug,
      p_kind: v.kind,
      p_whatsapp: v.whatsapp || undefined,
      p_options: {
        city: v.city,
        province: v.province,
        currency: v.currency,
        transfer_enabled: v.transferEnabled,
        whatsapp_enabled: v.whatsappEnabled,
        transfer: {
          discount_percent: v.transferDiscount,
          bank_name: v.bankName,
          holder: v.holder,
          cbu: v.cbu,
          alias: v.alias,
          cuit: v.cuit,
        },
      },
    });
    if (error || !storeId) {
      const msg = error?.message ?? "";
      if (/dirección no está disponible/i.test(msg)) return fail(STORE_SLUG_MESSAGES.taken, { slug: [STORE_SLUG_MESSAGES.taken] });
      if (/máximo de 3 tiendas/i.test(msg)) return fail("Llegaste al máximo de 3 tiendas por cuenta.");
      if (/forma de cobro|nombre de 2/i.test(msg)) return fail(msg);
      console.error("[app] create_store:", msg);
      return fail("No pudimos crear la tienda. Probá de nuevo.");
    }

    (await cookies()).set(ADMIN_STORE_COOKIE, storeId, ADMIN_STORE_COOKIE_OPTIONS);
    const { error: auditError } = await supabase.from("audit_log").insert({
      store_id: storeId,
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "store.create",
      entity: "store",
      entity_id: storeId,
      summary: `Creó la tienda ${v.name} (${v.slug})`,
    });
    if (auditError) console.error("[audit]", auditError.message);
    notifyStoreCreated({ supabase, storeId, slug: v.slug, name: v.name, ownerId: user.id, ownerEmail: user.email });
    return ok({ storeId, slug: v.slug });
  });
}
