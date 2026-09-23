import type { ZodError } from "zod";

/**
 * Resultado estándar de las Server Actions (spec §5).
 * Los errores de negocio se devuelven con `fail()`, nunca con `throw`.
 */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      /** `"plan"`: la acción no está incluida en el plan (la UI puede ofrecer "Ver planes"). */
      code?: "plan";
    };

export type ActionFailure = Extract<ActionResult<never>, { ok: false }>;

export function ok(): { ok: true; data: null };
export function ok<T>(data: T): { ok: true; data: T };
export function ok<T>(data?: T): { ok: true; data: T | null } {
  return { ok: true, data: data === undefined ? null : data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionFailure {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Convierte un ZodError en `fail()` con errores por campo (paths con puntos). */
export function zodFail(error: ZodError, message = "Revisá los campos marcados."): ActionFailure {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(message, fieldErrors);
}

export const GENERIC_ERROR = "Algo salió mal. Probá de nuevo.";

/**
 * Envuelve el cuerpo de una action: captura `AdminError` (→ su mensaje),
 * `PlanError` (→ su mensaje con `code: "plan"`, ver `src/lib/plans`) y
 * errores inesperados (→ console.error + mensaje genérico). Relanza los
 * `redirect()`/`notFound()` de Next.
 *
 *   export async function saveThing(input: unknown): Promise<ActionResult<{ id: string }>> {
 *     return runAction(async () => {
 *       const ctx = await requireAdmin();
 *       const parsed = schema.safeParse(input);
 *       if (!parsed.success) return zodFail(parsed.error);
 *       …
 *       revalidateTag("products", "max");
 *       return ok({ id });
 *     });
 *   }
 */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && err.name === "AdminError") {
      return fail(err.message || "No autorizado");
    }
    if (err instanceof Error && err.name === "PlanError") {
      return { ok: false, error: err.message, code: "plan" };
    }
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error(err);
    return fail(GENERIC_ERROR);
  }
}
