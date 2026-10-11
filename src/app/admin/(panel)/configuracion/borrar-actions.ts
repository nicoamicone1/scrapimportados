"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { purgeStore, PurgeError } from "@/lib/admin/purge";
import { ADMIN_STORE_COOKIE, requireOwner } from "@/lib/auth";

/**
 * Configuración › «Borrar la tienda» (0026): sólo quien la tiene a su nombre
 * o el superadmin (lo valida `purge_store`). Borra la tienda activa y saca la
 * cookie para que el panel vuelva a «Mis tiendas».
 */
export async function purgeActiveStore(input: { confirm: string }): Promise<ActionResult<{ name: string; storageWarning: string | null }>> {
  return runAction(async () => {
    const ctx = await requireOwner();
    const parsed = z.object({ confirm: z.string().trim().min(1, "Escribí la dirección de la tienda.") }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    try {
      const res = await purgeStore(ctx.supabase, ctx.store.id, parsed.data.confirm);
      (await cookies()).delete(ADMIN_STORE_COOKIE);
      return ok({ name: res.name, storageWarning: res.storageWarning });
    } catch (err) {
      if (err instanceof PurgeError) return fail(err.message);
      throw err;
    }
  });
}
