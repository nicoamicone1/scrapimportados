"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { markOnboarding } from "@/lib/onboarding";

/** Marca un paso manual del checklist de primeros pasos ("compartí tu link") o lo oculta. */
export async function markOnboardingStep(input: { step: string }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = z.object({ step: z.enum(["shared", "dismissed"]) }).safeParse(input);
    if (!parsed.success) return fail("Paso inválido.");
    await markOnboarding(ctx, parsed.data.step);
    revalidatePath("/admin");
    return ok();
  });
}
