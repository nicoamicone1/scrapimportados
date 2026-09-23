import "server-only";

import { notFound, redirect } from "next/navigation";

import { getProfile, getSession } from "@/lib/auth";

/** Página del superadmin: sin sesión → login; sin permiso → 404 (no revela que existe). */
export async function platformPageGuard(next: string) {
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const profile = await getProfile();
  if (!profile?.is_platform_admin) notFound();
  return { supabase, user, profile };
}
