"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { customerNotesSchema, customerSchema } from "@/lib/schemas/customer";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Alta y edición de clientes de la tienda activa (`ctx.store.id`). Los
 * clientes no afectan la caché pública.
 */

export async function saveCustomer(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const address = v.address && Object.values(v.address).some(Boolean) ? v.address : null;
    const row = {
      name: v.name,
      email: v.email,
      phone: v.phone,
      doc_number: v.docNumber,
      default_address: address,
      notes: v.notes,
      tags: v.tags,
    };

    if (v.email) {
      let dup = ctx.supabase.from("customers").select("id").eq("store_id", ctx.store.id).eq("email", v.email);
      if (v.id) dup = dup.neq("id", v.id);
      const { data } = await dup.maybeSingle();
      if (data) return fail("Ya hay un cliente con ese email.", { email: ["Ya hay un cliente con ese email"] });
    }

    if (v.id) {
      const { data: before } = await ctx.supabase
        .from("customers")
        .select("*")
        .eq("id", v.id)
        .eq("store_id", ctx.store.id)
        .maybeSingle();
      if (!before) return fail("El cliente no existe.");
      const { error } = await ctx.supabase.from("customers").update(row).eq("id", v.id).eq("store_id", ctx.store.id);
      if (error) return fail("No se pudo guardar el cliente.");
      await logAudit(ctx, {
        action: "customer.update",
        entity: "customer",
        entityId: v.id,
        summary: `Editó el cliente ${v.name}`,
        diff: shallowDiff(
          {
            name: before.name,
            email: before.email,
            phone: before.phone,
            doc_number: before.doc_number,
            notes: before.notes,
            tags: before.tags,
            default_address: before.default_address,
          },
          { ...row, default_address: row.default_address as Json },
        ),
      });
      revalidatePath("/admin/clientes");
      revalidatePath(`/admin/clientes/${v.id}`);
      return ok({ id: v.id });
    }

    const { data: created, error } = await ctx.supabase
      .from("customers")
      .insert({ ...row, store_id: ctx.store.id })
      .select("id")
      .single();
    if (error || !created) {
      if (error?.code === "23505") return fail("Ya hay un cliente con ese email.", { email: ["Ya existe"] });
      return fail("No se pudo crear el cliente.");
    }
    await logAudit(ctx, {
      action: "customer.create",
      entity: "customer",
      entityId: created.id,
      summary: `Creó el cliente ${v.name}`,
    });
    revalidatePath("/admin/clientes");
    return ok({ id: created.id });
  });
}

/** Variante para `.bind(null, id)` (autoguardado de notas en la ficha). */
export async function saveCustomerNotesFor(id: string, notes: string): Promise<ActionResult> {
  return saveCustomerNotes({ id, notes });
}

export async function saveCustomerNotes(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = customerNotesSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { data, error } = await ctx.supabase
      .from("customers")
      .update({ notes: parsed.data.notes.trim() || null })
      .eq("id", parsed.data.id)
      .eq("store_id", ctx.store.id)
      .select("name")
      .maybeSingle();
    if (error || !data) return fail("No se pudieron guardar las notas.");
    await logAudit(ctx, {
      action: "customer.notes",
      entity: "customer",
      entityId: parsed.data.id,
      summary: `Editó las notas de ${data.name ?? "un cliente"}`,
    });
    return ok();
  });
}
