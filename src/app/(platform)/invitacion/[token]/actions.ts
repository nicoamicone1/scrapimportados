"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_STORE_COOKIE, ADMIN_STORE_COOKIE_OPTIONS, getSession } from "@/lib/auth";

/** Acepta la invitación con la sesión actual y entra al panel de esa tienda. */
export async function acceptInvite(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invitacion/${token}`)}`);
  const { data, error } = await supabase.rpc("accept_store_invite", { p_token: token });
  if (error || !data) {
    redirect(`/invitacion/${token}?error=${encodeURIComponent(error?.message ?? "No pudimos aceptar la invitación.")}`);
  }
  (await cookies()).set(ADMIN_STORE_COOKIE, data, ADMIN_STORE_COOKIE_OPTIONS);
  redirect("/admin");
}
