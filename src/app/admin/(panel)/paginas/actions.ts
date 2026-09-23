"use server";

import { revalidateTag } from "next/cache";

import { renderBlockPreviews, type BlockPreviewNode } from "@/components/admin/builder/render-preview";
import type { PreviewDevice } from "@/components/admin/appearance/preview-css";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { getProductOptions, searchProductOptions, type ProductOption } from "@/lib/admin/pages";
import { logAudit } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { templateById } from "@/lib/blocks/defaults";
import { blockSchema, type Block } from "@/lib/blocks/schema";
import { tagFor, type CacheTagBase } from "@/lib/cache-tags";
import { assertFeature } from "@/lib/plans";
import { assertUsage } from "@/lib/plans/server";
import { createPageSchema, savePageSchema, type SavePageData } from "@/lib/schemas/page";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Actions del builder de páginas (agente E). Siempre: requireAdmin → zod →
 * escribir → revalidar → ActionResult. Todo sobre la tienda activa (los
 * slugs son únicos POR TIENDA). Plan: crear/duplicar páginas que no son la
 * portada exige `content.landings` y el límite `pages`.
 */

/** Expira ya (el dueño quiere ver el cambio al abrir la tienda). */
function expire(storeId: string, ...bases: CacheTagBase[]) {
  for (const base of new Set(bases)) revalidateTag(tagFor(base, storeId), { expire: 0 });
}

function revalidatePage(storeId: string, slug: string, ...more: string[]) {
  expire(storeId, "pages", ...(slug === "home" ? (["settings"] as const) : []));
  for (const s of new Set([slug, ...more])) revalidateTag(tagFor("page", storeId, s), { expire: 0 });
}

/** Alta de una página extra (todo lo que no es la portada): plan + límite. */
async function assertCanAddPage(ctx: AdminContext) {
  assertFeature(ctx, "content.landings");
  await assertUsage(ctx, "pages");
}

async function slugTaken(ctx: AdminContext, slug: string, exceptId?: string): Promise<boolean> {
  let q = ctx.supabase.from("pages").select("id").eq("store_id", ctx.store.id).eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.maybeSingle();
  return Boolean(data);
}

const SLUG_TAKEN = "Ya hay una página con ese slug.";

// ---------------------------------------------------------------------------
// Alta, duplicado y borrado
// ---------------------------------------------------------------------------

export async function createPage(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = createPageSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    await assertCanAddPage(ctx);
    if (await slugTaken(ctx, v.slug)) return fail(SLUG_TAKEN, { slug: [SLUG_TAKEN] });

    const blocks = templateById(v.template).build();
    const { data, error } = await ctx.supabase
      .from("pages")
      .insert({
        store_id: ctx.store.id,
        title: v.title,
        slug: v.slug,
        type: v.type,
        status: "draft",
        blocks: blocks as unknown as Json,
        seo: { title: "", description: "", og_image_url: "" },
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") return fail(SLUG_TAKEN, { slug: [SLUG_TAKEN] });
      if (error?.code === "23514") return fail("Ese slug no está permitido.", { slug: ["Ese slug no está permitido."] });
      throw new Error(error?.message ?? "insert pages");
    }
    await logAudit(ctx, { action: "page.create", entity: "page", entityId: data.id, summary: `Creó la página «${v.title}» (/${v.slug})` });
    expire(ctx.store.id, "pages");
    return ok({ id: data.id });
  });
}

export async function duplicatePage(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const { data: page } = await ctx.supabase
      .from("pages")
      .select("title, slug, type, blocks, seo")
      .eq("store_id", ctx.store.id)
      .eq("id", id)
      .maybeSingle();
    if (!page) return fail("No encontramos la página.");
    await assertCanAddPage(ctx);
    const { data: draft } = await ctx.supabase
      .from("page_drafts")
      .select("data")
      .eq("store_id", ctx.store.id)
      .eq("page_id", id)
      .maybeSingle();
    const draftData = draft?.data && typeof draft.data === "object" && !Array.isArray(draft.data) ? draft.data : null;

    const base = page.slug === "home" ? "portada" : page.slug;
    let slug = `${base}-copia`;
    for (let i = 2; (await slugTaken(ctx, slug)) && i < 50; i++) slug = `${base}-copia-${i}`;

    const { data, error } = await ctx.supabase
      .from("pages")
      .insert({
        store_id: ctx.store.id,
        title: `${page.title} (copia)`,
        slug,
        type: page.type === "home" ? "landing" : page.type,
        status: "draft",
        blocks: (draftData?.blocks ?? page.blocks) as Json,
        seo: (draftData?.seo ?? page.seo) as Json,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "duplicate page");
    await logAudit(ctx, { action: "page.duplicate", entity: "page", entityId: data.id, summary: `Duplicó «${page.title}» como /${slug}` });
    expire(ctx.store.id, "pages");
    return ok({ id: data.id });
  });
}

export async function deletePage(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const { data: page } = await ctx.supabase.from("pages").select("title, slug").eq("store_id", ctx.store.id).eq("id", id).maybeSingle();
    if (!page) return fail("No encontramos la página.");
    if (page.slug === "home") return fail("La portada no se puede borrar.");
    const { error } = await ctx.supabase.from("pages").delete().eq("store_id", ctx.store.id).eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit(ctx, { action: "page.delete", entity: "page", entityId: id, summary: `Borró la página «${page.title}» (/${page.slug})` });
    revalidatePage(ctx.store.id, page.slug);
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Guardar / publicar
// ---------------------------------------------------------------------------

export type SaveMode = "draft" | "publish";

export interface SavePageResult {
  status: "draft" | "published";
  /** Hay un borrador pendiente de publicar (página publicada guardada como borrador). */
  hasDraft: boolean;
  slug: string;
  updatedAt: string;
}

function draftPayload(v: SavePageData): Json {
  return { title: v.title, slug: v.slug, show_in_menu: v.showInMenu, seo: v.seo, blocks: v.blocks } as unknown as Json;
}

/**
 * - Página en borrador: "Guardar" escribe directo (no es pública); "Publicar" además la publica.
 * - Página publicada: "Guardar borrador" va a `page_drafts` (la tienda no cambia);
 *   "Publicar" copia todo a `pages` y borra el borrador.
 */
export async function savePage(input: unknown, mode: SaveMode): Promise<ActionResult<SavePageResult>> {
  return runAction<SavePageResult>(async () => {
    const ctx = await requireAdmin();
    const parsed = savePageSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, "Revisá los datos de la página: hay campos o bloques inválidos.");
    const v = parsed.data;

    const { data: current } = await ctx.supabase
      .from("pages")
      .select("id, slug, type, status, title")
      .eq("store_id", ctx.store.id)
      .eq("id", v.id)
      .maybeSingle();
    if (!current) return fail("No encontramos la página. Puede que la hayan borrado.");
    const isHome = current.slug === "home";
    if (isHome && (v.slug !== "home" || v.type !== "home")) return fail("La portada siempre es «home».");
    if (!isHome && v.type === "home") return fail("Sólo la portada puede ser de tipo portada.");
    if (v.slug !== current.slug && (await slugTaken(ctx, v.slug, v.id))) return fail(SLUG_TAKEN, { slug: [SLUG_TAKEN] });

    const now = new Date().toISOString();

    if (current.status === "published" && mode === "draft") {
      const { error } = await ctx.supabase
        .from("page_drafts")
        .upsert({ store_id: ctx.store.id, page_id: v.id, data: draftPayload(v), updated_at: now, updated_by: ctx.user.id });
      if (error) throw new Error(error.message);
      await logAudit(ctx, { action: "page.draft", entity: "page", entityId: v.id, summary: `Guardó un borrador de «${v.title}»` });
      return ok({ status: "published", hasDraft: true, slug: current.slug, updatedAt: now });
    }

    const publish = mode === "publish";
    const { data: updated, error } = await ctx.supabase
      .from("pages")
      .update({
        title: v.title,
        slug: v.slug,
        type: v.type,
        show_in_menu: v.showInMenu,
        seo: v.seo as unknown as Json,
        blocks: v.blocks as unknown as Json,
        ...(publish ? { status: "published", published_at: now } : {}),
      })
      .eq("store_id", ctx.store.id)
      .eq("id", v.id)
      .select("updated_at, status")
      .single();
    if (error) {
      if (error.code === "23505") return fail(SLUG_TAKEN, { slug: [SLUG_TAKEN] });
      throw new Error(error.message);
    }
    await ctx.supabase.from("page_drafts").delete().eq("store_id", ctx.store.id).eq("page_id", v.id);

    // Slug nuevo en una página que ya era pública: 301 desde el viejo (spec §13 · P0-02).
    if (current.status === "published" && v.slug !== current.slug) {
      const { error: redirectError } = await ctx.supabase
        .from("redirects")
        .upsert(
          { store_id: ctx.store.id, from_path: `/${current.slug}`, to_path: `/${v.slug}` },
          { onConflict: "store_id,from_path" },
        );
      if (redirectError) console.error("[pages] redirect", redirectError.message);
      expire(ctx.store.id, "redirects");
    }

    await logAudit(ctx, {
      action: publish ? "page.publish" : "page.update",
      entity: "page",
      entityId: v.id,
      summary: publish ? `Publicó «${v.title}» (/${v.slug})` : `Editó «${v.title}»`,
      diff: { blocks: v.blocks.length, slug: current.slug === v.slug ? v.slug : [current.slug, v.slug] } as Json,
    });
    revalidatePage(ctx.store.id, v.slug, current.slug);
    return ok({ status: updated.status === "published" ? "published" : "draft", hasDraft: false, slug: v.slug, updatedAt: updated.updated_at });
  });
}

export async function setPageStatus(id: string, status: "draft" | "published"): Promise<ActionResult<{ status: "draft" | "published" }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const { data: page } = await ctx.supabase
      .from("pages")
      .select("title, slug, published_at")
      .eq("store_id", ctx.store.id)
      .eq("id", id)
      .maybeSingle();
    if (!page) return fail("No encontramos la página.");
    if (page.slug === "home" && status === "draft") return fail("La portada no se puede despublicar: es la página de inicio de la tienda.");
    const { error } = await ctx.supabase
      .from("pages")
      .update({ status, ...(status === "published" ? { published_at: page.published_at ?? new Date().toISOString() } : {}) })
      .eq("store_id", ctx.store.id)
      .eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit(ctx, {
      action: status === "published" ? "page.publish" : "page.unpublish",
      entity: "page",
      entityId: id,
      summary: `${status === "published" ? "Publicó" : "Despublicó"} «${page.title}»`,
    });
    revalidatePage(ctx.store.id, page.slug);
    return ok({ status });
  });
}

export async function discardDraft(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const { error } = await ctx.supabase.from("page_drafts").delete().eq("store_id", ctx.store.id).eq("page_id", id);
    if (error) throw new Error(error.message);
    await logAudit(ctx, { action: "page.draft_discard", entity: "page", entityId: id, summary: "Descartó el borrador de una página" });
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Preview y pickers
// ---------------------------------------------------------------------------

export interface PreviewResult {
  nodes: BlockPreviewNode[];
  /** Ids de bloques que no pasan la validación (se muestran con aviso). */
  invalid: { id: string; message: string }[];
}

/** Renderiza los bloques (sin guardar) con los componentes reales de la tienda. */
export async function previewBlocks(input: unknown, device: PreviewDevice): Promise<ActionResult<PreviewResult>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!Array.isArray(input)) return fail("Bloques inválidos.");
    const valid: Block[] = [];
    const invalid: PreviewResult["invalid"] = [];
    for (const raw of input.slice(0, 80)) {
      const r = blockSchema.safeParse(raw);
      if (r.success) valid.push(r.data);
      else {
        const id = raw && typeof raw === "object" && "id" in raw ? String((raw as { id: unknown }).id) : "";
        const issue = r.error.issues[0];
        invalid.push({ id, message: `${issue.path.join(".")}: ${issue.message}` });
      }
    }
    const nodes = await renderBlockPreviews(ctx.store.id, valid, device === "mobile" ? "mobile" : "desktop");
    return ok({ nodes, invalid });
  });
}

export async function searchProducts(q: string): Promise<ActionResult<ProductOption[]>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    return ok(await searchProductOptions(String(q ?? "").slice(0, 100), ctx));
  });
}

export async function fetchProducts(ids: string[]): Promise<ActionResult<ProductOption[]>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const clean = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 60);
    return ok(await getProductOptions(clean, ctx));
  });
}
