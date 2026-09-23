import "server-only";

import type { AdminContext } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";

export interface AuditEntry {
  /** 'product.create', 'order.status', 'settings.update'… */
  action: string;
  entity?: string;
  entityId?: string | null;
  summary?: string;
  diff?: Json;
}

/**
 * Registra una acción en `audit_log` de la tienda activa (`ctx.store.id`).
 * Nunca rompe la action que la llama:
 * si falla, sólo loguea el error.
 *
 *   await logAudit(ctx, { action: "product.update", entity: "product", entityId: id, summary: `Editó ${name}` });
 */
export async function logAudit(
  ctx: Pick<AdminContext, "supabase" | "user" | "store">,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await ctx.supabase.from("audit_log").insert({
    store_id: ctx.store.id,
    actor_id: ctx.user.id,
    actor_email: ctx.user.email ?? null,
    action: entry.action,
    entity: entry.entity ?? null,
    entity_id: entry.entityId ?? null,
    summary: entry.summary ?? null,
    diff: entry.diff ?? null,
  });
  if (error) console.error("[audit]", error.message);
}

/** Diff superficial `{ campo: [antes, después] }` de los campos que cambiaron. */
export function shallowDiff(before: Record<string, Json | undefined>, after: Record<string, Json | undefined>): Json {
  const out: Record<string, Json> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = [a, b];
  }
  return out;
}
