import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewPasswordForm } from "@/app/(platform)/login/LoginForms";
import { AuthLayout } from "@/app/admin/AuthLayout";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Nueva contraseña" };
export const dynamic = "force-dynamic";

/**
 * Destino del link de "Olvidé mi contraseña" (vía /auth/callback, que ya
 * dejó la sesión de recuperación). Sin sesión, el link venció.
 */
export default async function ResetPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?error=link");
  return (
    <AuthLayout>
      <NewPasswordForm />
    </AuthLayout>
  );
}
