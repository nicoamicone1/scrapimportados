"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

/*
 * Acciones de autenticación de la PLATAFORMA (login, registro, reset,
 * logout). Viven acá por compatibilidad de imports (`signOut` lo usan el
 * topbar y la pantalla de espera). Corren con el cliente SSR: Supabase
 * escribe las cookies de sesión.
 */

/** Destinos internos permitidos después de ingresar (evita open redirects). */
const SAFE_PREFIXES = ["/admin", "/app", "/platform", "/invitacion"];

function safeNext(next: string | undefined | null, fallback = "/app"): string {
  if (!next || next.startsWith("//") || !next.startsWith("/")) return fallback;
  if (!SAFE_PREFIXES.some((p) => next === p || next.startsWith(`${p}/`) || next.startsWith(`${p}?`))) return fallback;
  if (next.startsWith("/admin/login") || next.startsWith("/admin/setup")) return fallback;
  return next;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

export type AuthFormState = ActionResult<{ message?: string; email?: string }> | null;

function fieldFail(error: z.ZodError): AuthFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) (fieldErrors[String(issue.path[0])] ??= []).push(issue.message);
  return fail("Revisá los datos.", fieldErrors);
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
  next: z.string().optional(),
});

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return fail("Todavía no confirmaste tu email. Revisá tu casilla.");
    }
    return fail("El email o la contraseña no coinciden.");
  }
  // Sin destino explícito: /app decide (una sola tienda → panel; ninguna → crearla).
  redirect(safeNext(parsed.data.next, "/app"));
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre.").max(80, "Hasta 80 caracteres."),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  password: z.string().min(8, "Usá al menos 8 caracteres.").max(72, "Hasta 72 caracteres."),
  terms: z.literal("on", { errorMap: () => ({ message: "Tenés que aceptar los términos para seguir." }) }),
  next: z.string().optional(),
});

/** Alta de cuenta (spec §14.3). Si Supabase exige confirmación, muestra "Revisá tu correo". */
export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    terms: formData.get("terms") ?? undefined,
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const next = safeNext(parsed.data.next, "/app/nueva");
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists")) {
      return fail("Ya hay una cuenta con ese email. Ingresá o recuperá tu contraseña.", { email: ["Ese email ya tiene cuenta."] });
    }
    if (msg.includes("invalid")) return fail("Ese email no es válido. Probá con otro.", { email: ["Email inválido."] });
    if (msg.includes("password")) return fail("Esa contraseña es muy débil. Probá con otra.", { password: ["Probá una contraseña más segura."] });
    console.error("[auth] signUp:", error.message);
    return fail("No pudimos crear la cuenta. Probá de nuevo en un rato.");
  }
  // Con confirmación de email activa, Supabase devuelve usuario sin sesión
  // (y, si el email ya existía, un usuario "ofuscado" sin identidades).
  if (!data.session) {
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return fail("Ya hay una cuenta con ese email. Ingresá o recuperá tu contraseña.", { email: ["Ese email ya tiene cuenta."] });
    }
    return { ok: true, data: { message: "confirm", email: parsed.data.email } };
  }
  redirect(next);
}

const resendSchema = z.object({ email: z.string().trim().toLowerCase().email("Ingresá un email válido.") });

/** Reenvía el email de confirmación del registro. */
export async function resendConfirmation(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fieldFail(parsed.error);
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/app/nueva` },
  });
  if (error) console.error("[auth] resend:", error.message);
  return { ok: true, data: { message: "Si la cuenta está pendiente de confirmar, te reenviamos el email.", email: parsed.data.email } };
}

const resetSchema = z.object({ email: z.string().trim().toLowerCase().email("Ingresá un email válido.") });

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`,
  });
  if (error) console.error("[auth] reset:", error.message);
  // Misma respuesta exista o no la cuenta (no revelar emails registrados).
  return { ok: true, data: { message: "Si el email tiene una cuenta, te llega un link para elegir una nueva contraseña." } };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Usá al menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden." });

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = passwordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("El link venció. Pedí uno nuevo.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("No pudimos cambiar la contraseña. Probá de nuevo.");
  redirect("/app");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
