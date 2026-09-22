"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/lib/admin/require";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin, ROLE_LABELS } from "@/lib/auth";
import { createPublicClient } from "@/lib/supabase/server";

/*
 * Usuarios y "Mi cuenta" (agente H). Gestionar el equipo es sólo del owner
 * (permiso `users.manage`; además la RLS de profiles sólo deja escribir al
 * owner y el trigger `profiles_guard_owner` impide dejar la tienda sin
 * dueño o cambiarse el propio rol).
 */

const idSchema = z.string().uuid("Usuario inválido.");
const assignableRole = z.enum(["owner", "admin", "staff"], { errorMap: () => ({ message: "Elegí un rol." }) });

function dbError(message: string): string | null {
  if (/al menos un dueño/i.test(message)) return "La tienda tiene que tener al menos un dueño activo.";
  if (/propio rol|desactivar tu cuenta/i.test(message)) return "No podés cambiar tu propio rol ni desactivar tu cuenta.";
  return null;
}

async function loadTarget(id: string) {
  const ctx = await requirePermission("users.manage");
  const { data, error } = await ctx.supabase.from("profiles").select("id, email, name, role, is_active").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return { ctx, target: data };
}

export async function approveUser(input: { id: string; role: string }): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = z.object({ id: idSchema, role: assignableRole }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { ctx, target } = await loadTarget(parsed.data.id);
    if (!target) return fail("El usuario ya no existe.");
    if (target.role !== "pending") return fail("Ese usuario ya fue aprobado.");

    const { error } = await ctx.supabase.from("profiles").update({ role: parsed.data.role, is_active: true }).eq("id", target.id);
    if (error) return fail(dbError(error.message) ?? error.message);
    await logAudit(ctx, {
      action: "user.approve",
      entity: "profile",
      entityId: target.id,
      summary: `Aprobó a ${target.email} como ${ROLE_LABELS[parsed.data.role]}`,
      diff: { role: [target.role, parsed.data.role], is_active: [target.is_active, true] },
    });
    return ok();
  });
}

export async function changeUserRole(input: { id: string; role: string }): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = z.object({ id: idSchema, role: assignableRole }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { ctx, target } = await loadTarget(parsed.data.id);
    if (!target) return fail("El usuario ya no existe.");
    if (target.id === ctx.user.id) return fail("No podés cambiar tu propio rol.");
    if (target.role === parsed.data.role) return ok();

    const { error } = await ctx.supabase.from("profiles").update({ role: parsed.data.role }).eq("id", target.id);
    if (error) return fail(dbError(error.message) ?? error.message);
    await logAudit(ctx, {
      action: "user.role",
      entity: "profile",
      entityId: target.id,
      summary: `Cambió el rol de ${target.email} a ${ROLE_LABELS[parsed.data.role]}`,
      diff: { role: [target.role, parsed.data.role] },
    });
    return ok();
  });
}

export async function setUserActive(input: { id: string; active: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = z.object({ id: idSchema, active: z.boolean() }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { ctx, target } = await loadTarget(parsed.data.id);
    if (!target) return fail("El usuario ya no existe.");
    if (target.id === ctx.user.id) return fail("No podés desactivar tu propia cuenta.");
    if (target.role === "pending") return fail("Primero aprobalo y elegí su rol.");

    const { error } = await ctx.supabase.from("profiles").update({ is_active: parsed.data.active }).eq("id", target.id);
    if (error) return fail(dbError(error.message) ?? error.message);
    await logAudit(ctx, {
      action: parsed.data.active ? "user.activate" : "user.deactivate",
      entity: "profile",
      entityId: target.id,
      summary: `${parsed.data.active ? "Reactivó" : "Desactivó"} a ${target.email}`,
      diff: { is_active: [target.is_active, parsed.data.active] },
    });
    return ok();
  });
}

const nameSchema = z.string().trim().min(1, "Ingresá un nombre.").max(80, "Hasta 80 caracteres.");

export async function renameUser(input: { id: string; name: string }): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = z.object({ id: idSchema, name: nameSchema }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { ctx, target } = await loadTarget(parsed.data.id);
    if (!target) return fail("El usuario ya no existe.");
    if (target.name === parsed.data.name) return ok();

    const { error } = await ctx.supabase.from("profiles").update({ name: parsed.data.name }).eq("id", target.id);
    if (error) throw new Error(error.message);
    await logAudit(ctx, {
      action: "user.rename",
      entity: "profile",
      entityId: target.id,
      summary: `Cambió el nombre de ${target.email}`,
      diff: { name: [target.name, parsed.data.name] },
    });
    return ok();
  });
}

// ---------------------------------------------------------------------
// Mi cuenta (cualquier usuario activo del panel)
// ---------------------------------------------------------------------

export async function updateMyName(input: { name: string }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = z.object({ name: nameSchema }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const before = ctx.profile.name;
    const { error } = await ctx.supabase.rpc("update_my_profile", { p_name: parsed.data.name });
    if (error) throw new Error(error.message);
    await ctx.supabase.auth.updateUser({ data: { name: parsed.data.name } });
    await logAudit(ctx, {
      action: "account.rename",
      entity: "profile",
      entityId: ctx.user.id,
      summary: "Cambió su nombre",
      diff: { name: [before, parsed.data.name] },
    });
    return ok();
  });
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Ingresá tu contraseña actual."),
    next: z
      .string()
      .min(10, "Usá al menos 10 caracteres.")
      .max(72, "Hasta 72 caracteres.")
      .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Combiná letras y números."),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] })
  .refine((v) => v.next !== v.current, { message: "Tiene que ser distinta de la actual.", path: ["next"] });

export async function changeMyPassword(input: { current: string; next: string; confirm: string }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = passwordSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const email = ctx.user.email;
    if (!email) return fail("Tu cuenta no tiene email.");

    // Verifica la contraseña actual con un cliente aparte (sin tocar las cookies de esta sesión).
    const verifier = createPublicClient();
    const { error: signInError } = await verifier.auth.signInWithPassword({ email, password: parsed.data.current });
    if (signInError) return fail("La contraseña actual no es correcta.", { current: ["La contraseña actual no es correcta."] });
    await verifier.auth.signOut({ scope: "local" });

    const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.next });
    if (error) {
      if (/weak|pwned|leaked/i.test(error.message)) return fail("Esa contraseña es muy débil o apareció en filtraciones. Probá otra.", { next: ["Probá una contraseña más segura."] });
      throw new Error(error.message);
    }
    await logAudit(ctx, { action: "account.password", entity: "profile", entityId: ctx.user.id, summary: "Cambió su contraseña" });
    return ok();
  });
}

/** Cierra la sesión en todos los dispositivos (revoca todos los refresh tokens). */
export async function signOutEverywhere(): Promise<ActionResult> {
  const result = await runAction(async () => {
    const ctx = await requireAdmin();
    await logAudit(ctx, { action: "account.signout_all", entity: "profile", entityId: ctx.user.id, summary: "Cerró sesión en todos los dispositivos" });
    const { error } = await ctx.supabase.auth.signOut({ scope: "global" });
    if (error) throw new Error(error.message);
    return ok();
  });
  if (result.ok) redirect("/admin/login");
  return result;
}
