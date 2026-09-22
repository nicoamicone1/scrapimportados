import "server-only";

import { requireAdmin, type AdminContext } from "@/lib/auth";
import { parseBlocks, type Block } from "@/lib/blocks/schema";
import type { PageSeo, PageStatus, PageType } from "@/lib/schemas/page";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Lecturas del admin para páginas del builder y sus pickers (agente E).
 * Sin caché: siempre datos frescos, bajo RLS como el usuario logueado.
 */

export interface AdminPageListItem {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  status: PageStatus;
  blockCount: number;
  showInMenu: boolean;
  updatedAt: string;
  publishedAt: string | null;
}

export interface PageContent {
  title: string;
  slug: string;
  showInMenu: boolean;
  seo: PageSeo;
  blocks: Block[];
}

export interface AdminPage extends AdminPageListItem {
  blocks: Block[];
  /** Bloques guardados que no pasaron la validación (se descartan al abrir). */
  invalidBlocks: number;
  seo: PageSeo;
  /** Borrador sin publicar de una página publicada (tabla `page_drafts`). */
  draft: (PageContent & { updatedAt: string; invalidBlocks: number }) | null;
}

function str(value: Json | undefined): string {
  return typeof value === "string" ? value : "";
}

export function parsePageSeo(value: Json): PageSeo {
  const o = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return { title: str(o.title), description: str(o.description), og_image_url: str(o.og_image_url) };
}

function asType(v: string): PageType {
  return v === "home" || v === "landing" || v === "legal" ? v : "custom";
}

export type PageFilter = "todas" | "publicadas" | "borradores";

export async function listAdminPages({ q = "", estado = "todas" }: { q?: string; estado?: PageFilter } = {}): Promise<AdminPageListItem[]> {
  const { supabase } = await requireAdmin();
  let query = supabase
    .from("pages")
    .select("id, title, slug, type, status, blocks, show_in_menu, updated_at, published_at")
    .order("updated_at", { ascending: false });
  if (estado === "publicadas") query = query.eq("status", "published");
  if (estado === "borradores") query = query.eq("status", "draft");
  const term = q.trim().replace(/[%_,()]/g, " ");
  if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    type: asType(p.type),
    status: (p.status === "published" ? "published" : "draft") as PageStatus,
    blockCount: Array.isArray(p.blocks) ? p.blocks.length : 0,
    showInMenu: p.show_in_menu,
    updatedAt: p.updated_at,
    publishedAt: p.published_at,
  }));
  // La portada siempre primero.
  return rows.sort((a, b) => Number(b.type === "home") - Number(a.type === "home"));
}

export async function getAdminPage(id: string): Promise<AdminPage | null> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select("id, title, slug, type, status, blocks, seo, show_in_menu, updated_at, published_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { blocks, errors } = parseBlocks(data.blocks);
  const { data: draftRow } = await supabase.from("page_drafts").select("data, updated_at").eq("page_id", id).maybeSingle();
  let draft: AdminPage["draft"] = null;
  if (draftRow) {
    const d = draftRow.data && typeof draftRow.data === "object" && !Array.isArray(draftRow.data) ? draftRow.data : {};
    const parsed = parseBlocks(d.blocks);
    draft = {
      title: str(d.title) || data.title,
      slug: str(d.slug) || data.slug,
      showInMenu: d.show_in_menu === true,
      seo: parsePageSeo(d.seo ?? {}),
      blocks: parsed.blocks,
      invalidBlocks: parsed.errors,
      updatedAt: draftRow.updated_at,
    };
  }
  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    type: asType(data.type),
    status: data.status === "published" ? "published" : "draft",
    blockCount: blocks.length,
    showInMenu: data.show_in_menu,
    updatedAt: data.updated_at,
    publishedAt: data.published_at,
    blocks,
    invalidBlocks: errors,
    seo: parsePageSeo(data.seo),
    draft,
  };
}

export async function getHomePageId(ctx?: AdminContext): Promise<string | null> {
  const { supabase } = ctx ?? (await requireAdmin());
  const { data } = await supabase.from("pages").select("id").eq("slug", "home").maybeSingle();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  /** "Hogar / Cocina" */
  path: string;
  depth: number;
  isVisible: boolean;
}

/** Categorías en orden de árbol con su ruta completa (para selects y buscadores). */
export async function listCategoryOptions(ctx?: AdminContext): Promise<CategoryOption[]> {
  const { supabase } = ctx ?? (await requireAdmin());
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, position, is_visible")
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const children = new Map<string | null, typeof rows>();
  for (const r of rows) {
    const key = r.parent_id && rows.some((x) => x.id === r.parent_id) ? r.parent_id : null;
    children.set(key, [...(children.get(key) ?? []), r]);
  }
  const out: CategoryOption[] = [];
  const walk = (parent: string | null, prefix: string, depth: number) => {
    for (const r of children.get(parent) ?? []) {
      const path = prefix ? `${prefix} / ${r.name}` : r.name;
      out.push({ id: r.id, name: r.name, slug: r.slug, parentId: r.parent_id, path, depth, isVisible: r.is_visible });
      if (depth < 6) walk(r.id, path, depth + 1);
    }
  };
  walk(null, "", 0);
  return out;
}

export interface ProductOption {
  id: string;
  name: string;
  slug: string;
  status: string;
  sku: string | null;
  imageUrl: string | null;
}

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  product_images: { url: string; position: number }[];
  product_variants: { sku: string | null; position: number }[];
};

function toOption(p: ProductRow): ProductOption {
  const img = [...p.product_images].sort((a, b) => a.position - b.position)[0];
  const variant = [...p.product_variants].sort((a, b) => a.position - b.position)[0];
  return { id: p.id, name: p.name, slug: p.slug, status: p.status, sku: variant?.sku ?? null, imageUrl: img?.url ?? null };
}

const PRODUCT_OPTION_SELECT = "id, name, slug, status, product_images(url, position), product_variants(sku, position)";

/** Búsqueda de productos por nombre o SKU (picker manual y menús). */
export async function searchProductOptions(q: string, ctx?: AdminContext, limit = 20): Promise<ProductOption[]> {
  const { supabase } = ctx ?? (await requireAdmin());
  const term = q.trim().replace(/[%_,()]/g, " ").trim();
  let query = supabase.from("products").select(PRODUCT_OPTION_SELECT).neq("status", "archived").order("updated_at", { ascending: false }).limit(limit);
  if (term) {
    // SKU exacto o parcial: se busca en variantes y se une con el nombre.
    const { data: bySku } = await supabase.from("product_variants").select("product_id").ilike("sku", `%${term}%`).limit(limit);
    const ids = [...new Set((bySku ?? []).map((v) => v.product_id))];
    query = ids.length ? query.or(`name.ilike.%${term}%,id.in.(${ids.join(",")})`) : query.ilike("name", `%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProductRow[]).map(toOption);
}

/** Productos por id, en el orden pedido (etiquetas del picker manual). */
export async function getProductOptions(ids: string[], ctx?: AdminContext): Promise<ProductOption[]> {
  if (!ids.length) return [];
  const { supabase } = ctx ?? (await requireAdmin());
  const { data, error } = await supabase.from("products").select(PRODUCT_OPTION_SELECT).in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map(((data ?? []) as ProductRow[]).map((p) => [p.id, toOption(p)]));
  return ids.map((id) => byId.get(id)).filter((p): p is ProductOption => !!p);
}

export interface PageOption {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
}

export async function listPageOptions(ctx?: AdminContext): Promise<PageOption[]> {
  const { supabase } = ctx ?? (await requireAdmin());
  const { data, error } = await supabase.from("pages").select("id, title, slug, status").order("title");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ id: p.id, title: p.title, slug: p.slug, status: p.status === "published" ? "published" : "draft" }));
}

/** Tags usados en productos (para sugerir en la fuente "por etiqueta"). */
export async function listProductTags(ctx?: AdminContext): Promise<string[]> {
  const { supabase } = ctx ?? (await requireAdmin());
  const { data } = await supabase.from("products").select("tags").neq("status", "archived").limit(2000);
  const set = new Set<string>();
  for (const row of data ?? []) for (const t of row.tags ?? []) if (t) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
