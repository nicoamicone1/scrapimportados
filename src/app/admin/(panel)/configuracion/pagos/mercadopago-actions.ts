"use server";

import { revalidateTag } from "next/cache";

import { flatDiff } from "@/lib/admin/diff";
import { requirePermission } from "@/lib/admin/require";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { AdminError, requireOwner } from "@/lib/auth";
import { tagFor } from "@/lib/cache-tags";
import { disconnectAccount, paymentsDb } from "@/lib/payments/accounts";
import { mercadoPagoSettingsSchema } from "@/lib/schemas/settings";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Cobro con tarjeta por Mercado Pago (docs/PAYMENTS.md). Conectar es una
 * ruta (/api/payments/mercadopago/oauth/start); acá: desconectar (sólo el
 * dueño con su sesión) y las opciones de cuotas (permiso settings.write).
 */

type Obj = { [key: string]: Json | undefined };
const obj = (v: Json | undefined): Obj => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export async function disconnectMercadoPago(): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireOwner();
    if (ctx.membership.impersonating) throw new AdminError("forbidden", "Sólo el dueño, con su cuenta, puede desconectar Mercado Pago.");
    const db = paymentsDb();
    if (!db) return fail("El cobro con Mercado Pago no está disponible en este momento.");
    await disconnectAccount(db, ctx.store.id);
    await logAudit(ctx, { action: "payments.mercadopago_disconnected", entity: "settings", entityId: "payments", summary: "Desconectó la cuenta de Mercado Pago" });
    revalidateTag(tagFor("payment-methods", ctx.store.id), "max");
    revalidateTag(tagFor("products", ctx.store.id), "max");
    return ok();
  });
}

export async function saveMercadoPagoSettings(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requirePermission("settings.write");
    const parsed = mercadoPagoSettingsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const next = {
      max_installments: parsed.data.max_installments,
      free_installments: Math.min(parsed.data.free_installments, parsed.data.max_installments),
      binary_mode: parsed.data.binary_mode,
      statement_descriptor: parsed.data.statement_descriptor,
    };

    const { data: row, error } = await ctx.supabase.from("store_settings").select("checkout").eq("store_id", ctx.store.id).single();
    if (error || !row) throw new Error(`No se pudo leer store_settings: ${error?.message ?? "sin fila"}`);
    const checkout = obj(row.checkout);
    const diff = flatDiff({ mercadopago: checkout.mercadopago ?? {} }, { mercadopago: next });
    if (!diff || typeof diff !== "object" || !Object.keys(diff).length) return ok();

    const { error: upErr } = await ctx.supabase
      .from("store_settings")
      .update({ checkout: { ...checkout, mercadopago: next } })
      .eq("store_id", ctx.store.id);
    if (upErr) throw new Error(upErr.message);
    await logAudit(ctx, { action: "settings.payments", entity: "settings", entityId: "payments", summary: "Actualizó las cuotas de Mercado Pago", diff });
    revalidateTag(tagFor("settings", ctx.store.id), "max");
    revalidateTag(tagFor("payment-methods", ctx.store.id), "max");
    return ok();
  });
}
