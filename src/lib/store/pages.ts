import "server-only";

import { unstable_cache } from "next/cache";

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

/** Página publicada por slug (o `null`). Tags: `pages`, `page:<slug>`. */
export function getPublishedPage(slug: string): Promise<StorePage | null> {
  return unstable_cache(
    async (): Promise<StorePage | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("pages")
        .select("id, title, slug, type, blocks, seo, published_at")
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
    ["store-page", slug],
    { tags: ["pages", `page:${slug}`], revalidate: CACHE_REVALIDATE },
  )();
}

export interface StorePageLink {
  title: string;
  slug: string;
}

/** Páginas publicadas marcadas "mostrar en menú". Tag: `pages`. */
export const listMenuPages = unstable_cache(
  async (): Promise<StorePageLink[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("title, slug")
      .eq("status", "published")
      .eq("show_in_menu", true)
      .neq("slug", "home")
      .order("title");
    if (error) throw new Error(`No se pudieron leer las páginas: ${error.message}`);
    return data ?? [];
  },
  ["store-menu-pages"],
  { tags: ["pages"], revalidate: CACHE_REVALIDATE },
);
