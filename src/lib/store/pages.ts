import "server-only";

import { unstable_cache } from "next/cache";

import { tagFor } from "@/lib/cache-tags";
import { parseBlocks, type Block } from "@/lib/blocks";
import { createPublicClient } from "@/lib/supabase/server";

import { asObject, asString, CACHE_REVALIDATE } from "./utils";

export interface StorePage {
  id: string;
  title: string;
  slug: string;
  type: "home" | "landing" | "legal" | "custom";
  blocks: Block[];
  seo: { title: string; description: string; og_image_url: string };
  publishedAt: string | null;
}

/** Página publicada por slug (o `null`). Tags: `pages:<storeId>`, `page:<storeId>:<slug>`. */
export function getPublishedPage(storeId: string, slug: string): Promise<StorePage | null> {
  return unstable_cache(
    async (): Promise<StorePage | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("pages")
        .select("id, title, slug, type, blocks, seo, published_at")
        .eq("store_id", storeId)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer la página ${slug}: ${error.message}`);
      if (!data) return null;
      const seo = asObject(data.seo);
      const { blocks, errors } = parseBlocks(data.blocks);
      if (errors) console.error(`[pages] ${errors} bloque(s) inválido(s) en "${slug}"`);
      return {
        id: data.id,
        title: data.title,
        slug: data.slug,
        type: data.type as StorePage["type"],
        blocks,
        seo: { title: asString(seo.title), description: asString(seo.description), og_image_url: asString(seo.og_image_url) },
        publishedAt: data.published_at,
      };
    },
    ["store-page", storeId, slug],
    { tags: [tagFor("pages", storeId), tagFor("page", storeId, slug)], revalidate: CACHE_REVALIDATE },
  )();
}

export interface StorePageLink {
  title: string;
  slug: string;
}

/** Páginas publicadas marcadas "mostrar en menú". Tag: `pages:<storeId>`. */
export function listMenuPages(storeId: string): Promise<StorePageLink[]> {
  return unstable_cache(
    async (): Promise<StorePageLink[]> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("pages")
        .select("title, slug")
        .eq("store_id", storeId)
        .eq("status", "published")
        .eq("show_in_menu", true)
        .neq("slug", "home")
        .order("title");
      if (error) throw new Error(`No se pudieron leer las páginas: ${error.message}`);
      return data ?? [];
    },
    ["store-menu-pages", storeId],
    { tags: [tagFor("pages", storeId)], revalidate: CACHE_REVALIDATE },
  )();
}
