"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { transferError } from "@/lib/admin/transfer";
import { ADMIN_STORE_COOKIE, ADMIN_STORE_COOKIE_OPTIONS, getSession } from "@/lib/auth";

/** Recibe la tienda con la sesión actual y entra a su panel. */
export async function acceptTransfer(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const here = `/invitacion/tienda/${token}`;
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);
  const { data, error } = await supabase.rpc("accept_store_transfer", { p_token: token });
  const storeId = data && typeof data === "object" && !Array.isArray(data) ? (data as { store_id?: unknown }).store_id : null;
  if (error || typeof storeId !== "string") {
    const message = error ? (transferError(error.message) ?? error.message) : "No pudimos pasarte la tienda. Probá de nuevo.";
    redirect(`${here}?error=${encodeURIComponent(message)}`);
  }
  (await cookies()).set(ADMIN_STORE_COOKIE, storeId, ADMIN_STORE_COOKIE_OPTIONS);
  redirect("/admin");
}
