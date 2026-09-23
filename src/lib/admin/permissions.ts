/**
 * Permisos del admin por rol EN LA TIENDA ACTIVA (`store_members.role`,
 * `ctx.membership`). Pura: sirve en server y client. Los permisos por rol
 * son ortogonales a los del plan (`src/lib/plans`): una acción puede exigir
 * ambos.
 *
 * | Permiso         | owner | admin | staff |
 * | --------------- | ----- | ----- | ----- |
 * | settings.write  |  sí   |  sí   |  no   |  Configuración (entrar y guardar)
 * | users.read      |  sí   |  sí   |  no   |  Ver la lista de usuarios
 * | users.manage    |  sí   |  no   |  no   |  Invitar, cambiar roles, desactivar
 * | prices.bulk     |  sí   |  sí   |  no   |  Cambios masivos de precios (C)
 * | audit.read      |  sí   |  sí   |  no   |  Registro de auditoría
 * | export          |  sí   |  sí   |  no   |  Exportar CSV
 *
 * Staff opera el día a día (pedidos, productos, stock, contenido) pero no
 * toca configuración, equipo, auditoría ni precios en masa.
 */

export type Permission = "settings.write" | "users.read" | "users.manage" | "prices.bulk" | "audit.read" | "export";

export interface PermissionSubject {
  role: string | null | undefined;
  is_active?: boolean | null;
}

const MATRIX: Record<Permission, readonly string[]> = {
  "settings.write": ["owner", "admin"],
  "users.read": ["owner", "admin"],
  "users.manage": ["owner"],
  "prices.bulk": ["owner", "admin"],
  "audit.read": ["owner", "admin"],
  export: ["owner", "admin"],
};

export function can(profile: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!profile || profile.is_active === false || !profile.role) return false;
  return MATRIX[permission].includes(profile.role);
}

export const PERMISSION_DENIED = "No tenés permiso para hacer esto.";
