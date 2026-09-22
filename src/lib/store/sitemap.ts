import "server-only";

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/server";

import { CACHE_REVALIDATE } from "./utils";

export interface PublishedPageRef {
  slug: string;
  updatedAt: string;
}

/** Páginas publicadas del builder (sin la home). Tag: `pages`. */
export const listPublishedPages = unstable_cache(
  async (): Promise<PublishedPageRef[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("pages").select("slug, updated_at").eq("status", "published").neq("slug", "home");
    if (error) throw new Error(`No se pudieron leer las páginas: ${error.message}`);
    return (data ?? []).map((p) => ({ slug: p.slug, updatedAt: p.updated_at }));
  },
  ["store-published-pages"],
  { tags: ["pages"], revalidate: CACHE_REVALIDATE },
);
