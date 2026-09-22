import "server-only";

import { AdminError, requireAdmin, type AdminContext } from "@/lib/auth";

import { can, PERMISSION_DENIED, type Permission } from "./permissions";

/**
 * `requireAdmin()` + chequeo de permiso por rol (ver `permissions.ts`).
 * Lanza `AdminError('forbidden')`, que `runAction()` convierte en `fail()`.
 */
export async function requirePermission(permission: Permission): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!can(ctx.profile, permission)) throw new AdminError("forbidden", PERMISSION_DENIED);
  return ctx;
}
