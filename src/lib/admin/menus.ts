import "server-only";

import { requireAdmin } from "@/lib/auth";
import { LINK_KINDS, MENU_HANDLES, type LinkKind, type MenuHandle, type MenuItemInput } from "@/lib/schemas/menu";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Lectura de menús para el editor (agente E). Conserva `newTab` y `link`
 * (de dónde salió el destino) además de lo que usa el storefront.
 */

function obj(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseItems(value: Json | undefined, depth = 0): MenuItemInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const o = obj(raw);
      const link = obj(o.link);
      const kind = typeof link.kind === "string" && (LINK_KINDS as readonly string[]).includes(link.kind) ? (link.kind as LinkKind) : undefined;
      const href = typeof o.href === "string" ? o.href : "";
      return {
        label: typeof o.label === "string" ? o.label : "",
        href,
        newTab: o.newTab === true,
        link: kind
          ? { kind, id: typeof link.id === "string" ? link.id : undefined }
          : { kind: /^(https?:|mailto:|tel:)/i.test(href) ? ("external" as const) : ("internal" as const) },
        children: depth < 1 ? parseItems(o.children, depth + 1) : [],
      };
    })
    .filter((i) => i.label);
}

export type AdminMenus = Record<MenuHandle, { items: MenuItemInput[]; updatedAt: string | null }>;

export async function getAdminMenus(): Promise<AdminMenus> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("menus")
    .select("handle, items, updated_at")
    .eq("store_id", store.id)
    .in("handle", [...MENU_HANDLES]);
  if (error) throw new Error(error.message);
  const out: AdminMenus = { header: { items: [], updatedAt: null }, footer: { items: [], updatedAt: null } };
  for (const row of data ?? []) {
    if ((MENU_HANDLES as readonly string[]).includes(row.handle)) {
      out[row.handle as MenuHandle] = { items: parseItems(row.items), updatedAt: row.updated_at };
    }
  }
  return out;
}
