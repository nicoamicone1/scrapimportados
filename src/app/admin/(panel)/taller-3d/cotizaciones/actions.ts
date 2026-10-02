"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { getWorkshop } from "@/lib/admin/print3d-production";
import { todayYmd } from "@/lib/admin/print3d-production-utils";
import { logAudit } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { formatMoney, roundMoney } from "@/lib/money";
import { requireModule } from "@/lib/modules/server";
import { quoteTotals } from "@/lib/print3d";

/*
 * Server Actions de cotizaciones (TALLER-3D §6): aprobar con precio
 * (recalcula totales con el motor y los settings, nueva validez) y rechazar.
 * Una cotización ya pedida (`ordered`) no se toca: su precio vive en el pedido.
 */

const uuid = z.string().uuid("Id inválido.");
const note = z
  .string()
  .trim()
  .max(1000, "Máximo 1000 caracteres.")
  .transform((v) => v || null)
  .nullable();

async function moduleCtx(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  requireModule(ctx, "print3d");
  return ctx;
}

function revalidateQuote(storeId: string, id: string) {
  revalidateTag(`print3d:${storeId}`, "max");
  revalidatePath("/admin/taller-3d", "layout");
  revalidatePath(`/admin/taller-3d/cotizaciones/${id}`);
}

async function loadQuote(ctx: AdminContext, id: string) {
  const { data } = await ctx.supabase
    .from("print3d_quotes")
    .select("id, token, status, total, contact")
    .eq("store_id", ctx.store.id)
    .eq("id", id)
    .maybeSingle();
  return data;
}

const approveSchema = z.object({
  quoteId: uuid,
  items: z
    .array(
      z.object({
        id: uuid,
        unitPrice: z.coerce
          .number({ invalid_type_error: "Poné un precio." })
          .positive("Tiene que ser mayor a 0.")
          .max(100_000_000, "Revisá el precio."),
      }),
    )
    .min(1)
    .max(20),
  reviewNote: note,
  readyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
    .nullable(),
});

export async function approveQuote(input: unknown): Promise<ActionResult<{ total: number; expiresAt: string }>> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = approveSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const quote = await loadQuote(ctx, v.quoteId);
    if (!quote) return fail("La cotización no existe.");
    if (quote.status === "ordered") return fail("Esta cotización ya se convirtió en pedido: el precio se cambia en el pedido.");

    const { data: items } = await ctx.supabase
      .from("print3d_quote_items")
      .select("id, qty, unit_price")
      .eq("store_id", ctx.store.id)
      .eq("quote_id", quote.id);
    const rows = items ?? [];
    const prices = new Map(v.items.map((i) => [i.id, roundMoney(i.unitPrice)]));
    if (!rows.length || rows.some((r) => !prices.has(r.id)) || prices.size !== rows.length) {
      return fail("Falta el precio de alguna pieza. Refrescá y probá de nuevo.");
    }

    const workshop = await getWorkshop(ctx.supabase, ctx.store.id);
    if (v.readyDate && v.readyDate < todayYmd(workshop.timezone)) return fail("La fecha de entrega ya pasó.", { readyDate: ["Elegí hoy o más adelante."] });

    const lines = rows.map((r) => {
      const unit = prices.get(r.id)!;
      return { id: r.id, unit, total: roundMoney(unit * Number(r.qty)) };
    });
    const results = await Promise.all(
      lines.map((l) =>
        ctx.supabase
          .from("print3d_quote_items")
          .update({ unit_price: l.unit, total: l.total, needs_review: false })
          .eq("store_id", ctx.store.id)
          .eq("id", l.id),
      ),
    );
    if (results.some((r) => r.error)) return fail("No se pudieron guardar los precios.");

    const totals = quoteTotals(
      lines.map((l) => l.total),
      workshop.settings,
    );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + Math.max(1, workshop.settings.quote_valid_days) * 86_400_000).toISOString();
    const { error } = await ctx.supabase
      .from("print3d_quotes")
      .update({
        status: "priced",
        subtotal: totals.subtotal,
        setup_fee: totals.setup_fee,
        min_adjustment: totals.min_adjustment,
        total: totals.total,
        expires_at: expiresAt,
        review_note: v.reviewNote,
        reviewed_by: ctx.user.id,
        reviewed_at: now.toISOString(),
        ...(v.readyDate ? { estimated_ready_date: v.readyDate } : {}),
      })
      .eq("store_id", ctx.store.id)
      .eq("id", quote.id)
      .neq("status", "ordered");
    if (error) return fail("No se pudo aprobar la cotización.");

    await logAudit(ctx, {
      action: "print3d.quote.approve",
      entity: "print3d_quote",
      entityId: quote.id,
      summary: `Aprobó la cotización ${quote.token.slice(0, 6)} por ${formatMoney(totals.total)}`,
      diff: {
        status: [quote.status, "priced"],
        total: [quote.total === null ? null : Number(quote.total), totals.total],
        items: lines.map((l) => ({ id: l.id, unit_price: l.unit })),
      },
    });
    revalidateQuote(ctx.store.id, quote.id);
    return ok({ total: totals.total, expiresAt });
  });
}

const rejectSchema = z.object({ quoteId: uuid, reviewNote: note });

export async function rejectQuote(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = rejectSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const quote = await loadQuote(ctx, v.quoteId);
    if (!quote) return fail("La cotización no existe.");
    if (quote.status === "ordered") return fail("Esta cotización ya es un pedido: cancelalo desde Pedidos.");
    if (quote.status === "rejected") return ok();

    const { error } = await ctx.supabase
      .from("print3d_quotes")
      .update({ status: "rejected", review_note: v.reviewNote, reviewed_by: ctx.user.id, reviewed_at: new Date().toISOString() })
      .eq("store_id", ctx.store.id)
      .eq("id", quote.id)
      .neq("status", "ordered");
    if (error) return fail("No se pudo rechazar la cotización.");

    await logAudit(ctx, {
      action: "print3d.quote.reject",
      entity: "print3d_quote",
      entityId: quote.id,
      summary: `Rechazó la cotización ${quote.token.slice(0, 6)}`,
      diff: { status: [quote.status, "rejected"] },
    });
    revalidateQuote(ctx.store.id, quote.id);
    return ok();
  });
}
