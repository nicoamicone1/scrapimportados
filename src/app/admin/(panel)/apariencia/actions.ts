"use server";

import { revalidateTag } from "next/cache";
import type { ReactNode } from "react";

import type { PreviewDevice } from "@/components/admin/appearance/preview-css";
import { ThemePreview } from "@/components/admin/appearance/ThemePreview";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { announcementSchema, brandSchema, saveThemeSchema } from "@/lib/schemas/appearance";
import type { Json } from "@/lib/supabase/database.types";
import { parseTheme, themeSchema } from "@/lib/theme";

/*
 * Actions de Apariencia (agente E): tema, marca y barra de anuncio →
 * `store_settings` → revalidateTag('settings').
 */

function expireSettings() {
  // Expira ya: el dueño guarda y abre la tienda esperando ver el cambio.
  revalidateTag("settings", { expire: 0 });
}

export async function saveTheme(input: unknown): Promise<ActionResult<{ preset: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = saveThemeSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, "Revisá el tema: hay valores inválidos.");
    const theme = { ...parsed.data, custom_css: parsed.data.custom_css?.trim() ? parsed.data.custom_css : undefined };

    const { data: before } = await ctx.supabase.from("store_settings").select("theme").eq("id", 1).single();
    const { error } = await ctx.supabase.from("store_settings").update({ theme: theme as unknown as Json }).eq("id", 1);
    if (error) throw new Error(error.message);

    const prev = parseTheme(before?.theme ?? {});
    const changed = Object.keys(shallowDiff(prev as unknown as Record<string, Json>, theme as unknown as Record<string, Json>) as Record<string, Json>);
    await logAudit(ctx, {
      action: "settings.theme",
      entity: "store_settings",
      entityId: "1",
      summary: `Cambió el tema (${theme.preset === "custom" ? "personalizado" : `preset ${theme.preset}`})${changed.length ? `: ${changed.join(", ")}` : ""}`,
    });
    expireSettings();
    return ok({ preset: theme.preset });
  });
}

export async function saveBrand(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = brandSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const { data: before } = await ctx.supabase.from("store_settings").select("name, tagline, logo_url, favicon_url").eq("id", 1).single();
    const next = { name: v.name, tagline: v.tagline || null, logo_url: v.logo_url || null, favicon_url: v.favicon_url || null };
    const { error } = await ctx.supabase.from("store_settings").update(next).eq("id", 1);
    if (error) throw new Error(error.message);
    await logAudit(ctx, {
      action: "settings.brand",
      entity: "store_settings",
      entityId: "1",
      summary: "Actualizó la marca de la tienda",
      diff: before ? shallowDiff(before, next) : undefined,
    });
    expireSettings();
    return ok();
  });
}

export async function saveAnnouncement(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = announcementSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { error } = await ctx.supabase.from("store_settings").update({ announcement: parsed.data as unknown as Json }).eq("id", 1);
    if (error) throw new Error(error.message);
    await logAudit(ctx, {
      action: "settings.announcement",
      entity: "store_settings",
      entityId: "1",
      summary: parsed.data.enabled ? `Activó la barra de anuncio: «${parsed.data.text}»` : "Desactivó la barra de anuncio",
    });
    expireSettings();
    return ok();
  });
}

/** Preview del storefront con el tema SIN guardar (componentes reales, render en el server). */
export async function previewTheme(input: unknown, device: PreviewDevice): Promise<ActionResult<{ node: ReactNode }>> {
  return runAction(async () => {
    await requireAdmin();
    const parsed = themeSchema.safeParse(input);
    if (!parsed.success) return fail("El tema tiene valores inválidos.");
    const node = await ThemePreview({ theme: parsed.data, device: device === "mobile" ? "mobile" : "desktop" });
    return ok({ node });
  });
}
