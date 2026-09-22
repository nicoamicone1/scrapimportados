"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

/*
 * Acciones de autenticación del admin (login, reset, setup, logout).
 * Corren con el cliente SSR: Supabase escribe las cookies de sesión.
 */

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
  next: z.string().optional(),
});

/** Sólo redirecciones internas al admin (evita open redirects). */
function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//") || next.startsWith("/admin/login")) return "/admin";
  return next;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

export type AuthFormState = ActionResult<{ message?: string }> | null;

function fieldFail(error: z.ZodError): AuthFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) (fieldErrors[String(issue.path[0])] ??= []).push(issue.message);
  return fail("Revisá los datos.", fieldErrors);
}

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
  redirect(safeNext(parsed.data.next));
}

const resetSchema = z.object({ email: z.string().trim().toLowerCase().email("Ingresá un email válido.") });

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/admin/auth/callback?next=${encodeURIComponent("/admin/login?reset=1")}`,
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
  redirect("/admin");
}

const setupSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre.").max(80),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  password: z.string().min(8, "Usá al menos 8 caracteres."),
});

/** Alta del primer dueño. Sólo funciona si todavía no hay owner. */
export async function setupOwner(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();
  const { data: hasOwner, error: ownerError } = await supabase.rpc("has_owner");
  if (ownerError) {
    console.error("[auth] has_owner:", ownerError.message);
    return fail("Algo salió mal. Probá de nuevo.");
  }
  if (hasOwner) return fail("La tienda ya tiene dueño. Ingresá con tu cuenta o pedile acceso.");

  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${origin}/admin/auth/callback?next=/admin`,
    },
  });
  if (error) {
    return fail(
      error.message.toLowerCase().includes("invalid")
        ? "Ese email no es válido para el proveedor de autenticación. Probá con otro."
        : `No pudimos crear la cuenta: ${error.message}`,
    );
  }
  if (!data.session) {
    return {
      ok: true,
      data: { message: `Te enviamos un email a ${parsed.data.email} para confirmar la cuenta. Después ingresá desde /admin/login.` },
    };
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
