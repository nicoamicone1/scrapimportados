"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/lib/admin/require";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin, ROLE_LABELS } from "@/lib/auth";
import { assertFeature } from "@/lib/plans";
import { assertUsage } from "@/lib/plans/server";
import { createPublicClient } from "@/lib/supabase/server";

/*
 * Equipo de la tienda activa (store_members) y "Mi cuenta". Gestionar el
 * equipo es sólo del dueño (permiso `users.manage`; además la RLS de
 * store_members sólo deja escribir al dueño y el trigger
 * `store_members_guard_owner` impide dejar la tienda sin dueño o cambiarse
 * el propio rol). Sumar gente depende del plan (`team.members` + límite `staff`).
 */

const idSchema = z.string().uuid("Usuario inválido.");
const assignableRole = z.enum(["owner", "admin", "staff"], { errorMap: () => ({ message: "Elegí un rol." }) });

function dbError(message: string): string | null {
  if (/al menos un dueño/i.test(message)) return "La tienda tiene que tener al menos un dueño activo.";
  if (/propio rol|desactivar tu cuenta/i.test(message)) return "No podés cambiar tu propio rol ni desactivar tu cuenta.";
  if (/ya es parte del equipo/i.test(message)) return "Esa persona ya es parte del equipo.";
  if (/email válido/i.test(message)) return "Ingresá un email válido.";
  return null;
}

async function loadTarget(id: string) {
  const ctx = await requirePermission("users.manage");
  const { data, error } = await ctx.supabase
    .from("store_members")
    .select("user_id, role, is_active")
    .eq("store_id", ctx.store.id)
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ctx, target: null };
  // store_members.user_id apunta a auth.users (no hay relación directa con profiles).
  const { data: profile } = await ctx.supabase.from("profiles").select("email, name").eq("id", id).maybeSingle();
  return {
    ctx,
    target: { id: data.user_id, role: data.role, is_active: data.is_active, email: profile?.email ?? "", name: profile?.name ?? null },
  };
}

export async function changeUserRole(input: { id: string; role: string }): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = z.object({ id: idSchema, role: assignableRole }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { ctx, target } = await loadTarget(parsed.data.id);
    if (!target) return fail("Esa persona ya no es parte del equipo.");
    if (target.id === ctx.user.id) return fail("No podés cambiar tu propio rol.");
    if (target.role === parsed.data.role) return ok();

    const { error } = await ctx.supabase
      .from("store_members")
      .update({ role: parsed.data.role })
      .eq("store_id", ctx.store.id)
      .eq("user_id", target.id);
    if (error) return fail(dbError(error.message) ?? error.message);
    await logAudit(ctx, {
      action: "user.role",
      entity: "store_member",
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
    if (!target) return fail("Esa persona ya no es parte del equipo.");
    if (target.id === ctx.user.id) return fail("No podés desactivar tu propia cuenta.");
    if (parsed.data.active && !target.is_active) await assertUsage(ctx, "staff");

    const { error } = await ctx.supabase
      .from("store_members")
      .update({ is_active: parsed.data.active })
      .eq("store_id", ctx.store.id)
      .eq("user_id", target.id);
    if (error) return fail(dbError(error.message) ?? error.message);
    await logAudit(ctx, {
      action: parsed.data.active ? "user.activate" : "user.deactivate",
      entity: "store_member",
      entityId: target.id,
      summary: `${parsed.data.active ? "Reactivó" : "Desactivó"} a ${target.email}`,
      diff: { is_active: [target.is_active, parsed.data.active] },
    });
    return ok();
  });
}

/** Quita a alguien del equipo de esta tienda (su cuenta de Ecommy sigue existiendo). */
export async function removeMember(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = z.object({ id: idSchema }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { ctx, target } = await loadTarget(parsed.data.id);
    if (!target) return ok();
    if (target.id === ctx.user.id) return fail("No podés quitarte a vos del equipo.");

    const { error } = await ctx.supabase.from("store_members").delete().eq("store_id", ctx.store.id).eq("user_id", target.id);
    if (error) return fail(dbError(error.message) ?? error.message);
    await logAudit(ctx, {
      action: "user.remove",
      entity: "store_member",
      entityId: target.id,
      summary: `Quitó a ${target.email} del equipo`,
    });
    return ok();
  });
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  role: z.enum(["admin", "staff"], { errorMap: () => ({ message: "Elegí un rol." }) }),
});

export type InviteResult = { status: "added"; email: string } | { status: "invited"; email: string; token: string };

/**
 * Invita por email. Si la persona ya tiene cuenta en Ecommy, la suma al
 * equipo directo; si no, crea una invitación con token y devuelve el link
 * `/invitacion/<token>` para compartir a mano (todavía no mandamos emails).
 */
export async function inviteMember(input: { email: string; role: string }): Promise<ActionResult<InviteResult>> {
  return runAction(async () => {
    const ctx = await requirePermission("users.manage");
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    assertFeature(ctx, "team.members");
    await assertUsage(ctx, "staff");

    const { data, error } = await ctx.supabase.rpc("invite_store_member", {
      p_store_id: ctx.store.id,
      p_email: parsed.data.email,
      p_role: parsed.data.role,
    });
    if (error) return fail(dbError(error.message) ?? error.message);
    const res = (data ?? {}) as { status?: string; token?: string };
    await logAudit(ctx, {
      action: res.status === "added" ? "user.add" : "user.invite",
      entity: "store_member",
      entityId: parsed.data.email,
      summary: `${res.status === "added" ? "Sumó" : "Invitó"} a ${parsed.data.email} como ${ROLE_LABELS[parsed.data.role]}`,
    });
    if (res.status === "invited" && res.token) return ok<InviteResult>({ status: "invited", email: parsed.data.email, token: res.token });
    return ok<InviteResult>({ status: "added", email: parsed.data.email });
  });
}

export async function revokeInvite(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requirePermission("users.manage");
    const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return fail("Invitación inválida.");
    const { data, error } = await ctx.supabase
      .from("store_invites")
      .delete()
      .eq("store_id", ctx.store.id)
      .eq("id", parsed.data.id)
      .select("email")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      await logAudit(ctx, { action: "user.invite_revoke", entity: "store_invite", entityId: parsed.data.id, summary: `Anuló la invitación de ${data.email}` });
    }
    return ok();
  });
}

const nameSchema = z.string().trim().min(1, "Ingresá un nombre.").max(80, "Hasta 80 caracteres.");

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
  if (result.ok) redirect("/login");
  return result;
}
