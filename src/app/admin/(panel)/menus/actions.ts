"use server";

import { revalidateTag } from "next/cache";

import { ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { tagFor } from "@/lib/cache-tags";
import { MENU_LABELS, saveMenuSchema } from "@/lib/schemas/menu";
import type { Json } from "@/lib/supabase/database.types";

/** Guarda el menú `header` o `footer` de la tienda activa (agente E) → revalida `menus:<storeId>`. */
export async function saveMenu(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = saveMenuSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, "Revisá los ítems marcados.");
    const { handle } = parsed.data;
    // Un grupo sin destino propio se guarda con "#" (el storefront lo trata como título).
    const items = parsed.data.items.map((i) => ({
      label: i.label,
      href: i.href || "#",
      ...(i.newTab ? { newTab: true } : {}),
      ...(i.link ? { link: i.link } : {}),
      children: i.children.map((c) => ({ label: c.label, href: c.href, ...(c.newTab ? { newTab: true } : {}), ...(c.link ? { link: c.link } : {}), children: [] })),
    }));
    const { error } = await ctx.supabase
      .from("menus")
      .upsert({ store_id: ctx.store.id, handle, items: items as unknown as Json }, { onConflict: "store_id,handle" });
    if (error) throw new Error(error.message);
    const count = items.reduce((n, i) => n + 1 + i.children.length, 0);
    await logAudit(ctx, { action: "menu.update", entity: "menu", entityId: handle, summary: `Editó el ${MENU_LABELS[handle].title.toLowerCase()} (${count} links)` });
    revalidateTag(tagFor("menus", ctx.store.id), { expire: 0 });
    return ok({ count });
  });
}
