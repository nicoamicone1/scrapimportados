import "server-only";

import { unstable_cache } from "next/cache";

import { tagFor } from "@/lib/cache-tags";
import type { Json } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/server";

import { asArray, asObject, asString, CACHE_REVALIDATE } from "./utils";

export interface MenuItem {
  label: string;
  href: string;
  children: MenuItem[];
}

export function parseMenuItems(value: Json | undefined, depth = 0): MenuItem[] {
  return asArray(value)
    .map((raw) => {
      const o = asObject(raw);
      return {
        label: asString(o.label).trim(),
        href: asString(o.href, "#").trim() || "#",
        children: depth < 2 ? parseMenuItems(o.children, depth + 1) : [],
      };
    })
    .filter((i) => i.label);
}

export type Menus = Record<string, MenuItem[]> & { header: MenuItem[]; footer: MenuItem[] };

/** Menús por handle (`header`, `footer`, …). Tag: `menus:<storeId>`. */
export function getMenus(storeId: string): Promise<Menus> {
  return unstable_cache(
    async (): Promise<Menus> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase.from("menus").select("handle, items").eq("store_id", storeId);
      if (error) throw new Error(`No se pudieron leer los menús: ${error.message}`);
      const menus: Menus = { header: [], footer: [] };
      for (const row of data ?? []) menus[row.handle] = parseMenuItems(row.items);
      return menus;
    },
    ["store-menus", storeId],
    { tags: [tagFor("menus", storeId)], revalidate: CACHE_REVALIDATE },
  )();
}
