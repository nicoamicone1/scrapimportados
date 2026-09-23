"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";

/*
 * Bandeja de "Avisame cuando haya stock" (migración 0016). El alta es
 * pública (RPC); desde el panel sólo se borran pedidos de aviso.
 */

const deleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

export async function deleteStockAlerts(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) return fail("No se pudo borrar: recargá la página.");
    const { data, error } = await ctx.supabase
      .from("stock_alerts")
      .delete()
      .eq("store_id", ctx.store.id)
      .in("id", parsed.data.ids)
      .select("id");
    if (error) throw new Error(error.message);
    const count = data?.length ?? 0;
    if (count) {
      await logAudit(ctx, {
        action: "stock_alert.delete",
        entity: "stock_alert",
        entityId: count === 1 ? data?.[0]?.id : null,
        summary: count === 1 ? "Borró un aviso de stock" : `Borró ${count} avisos de stock`,
      });
    }
    refresh();
    return ok({ count });
  });
}
