import "server-only";

import { unstable_cache } from "next/cache";

import { tagFor } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/server";

import { CACHE_REVALIDATE } from "./utils";

export interface PublishedPageRef {
  slug: string;
  updatedAt: string;
}

/** Páginas publicadas del builder (sin la home). Tag: `pages:<storeId>`. */
export function listPublishedPages(storeId: string): Promise<PublishedPageRef[]> {
  return unstable_cache(
    async (): Promise<PublishedPageRef[]> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("pages")
        .select("slug, updated_at")
        .eq("store_id", storeId)
        .eq("status", "published")
        .neq("slug", "home");
      if (error) throw new Error(`No se pudieron leer las páginas: ${error.message}`);
      return (data ?? []).map((p) => ({ slug: p.slug, updatedAt: p.updated_at }));
    },
    ["store-published-pages", storeId],
    { tags: [tagFor("pages", storeId)], revalidate: CACHE_REVALIDATE },
  )();
}
