import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/store/settings";

import { AuthLayout } from "../AuthLayout";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Configuración inicial" };
export const dynamic = "force-dynamic";

/** Alta del primer dueño. Si ya hay owner, sólo muestra el camino al login. */
export default async function SetupPage() {
  const supabase = await createClient();
  const { data: hasOwner } = await supabase.rpc("has_owner");
  let storeName = "Ecommy";
  try {
    storeName = (await getSettings()).name;
  } catch {
    // La tienda todavía puede no tener settings.
  }

  return (
    <AuthLayout storeName={storeName}>
      {hasOwner ? (
        <div>
          <h1 className="text-xl font-semibold">La tienda ya tiene dueño</h1>
          <p className="mt-1 text-sm text-adm-fg-muted">
            Ingresá con tu cuenta. Si necesitás acceso, pedíselo al dueño: puede aprobarte desde Usuarios.
          </p>
          <ButtonLink href="/admin/login" variant="primary" size="lg" className="mt-6">
            Ir a ingresar
          </ButtonLink>
        </div>
      ) : (
        <div>
          <h1 className="text-xl font-semibold">Creá la cuenta del dueño</h1>
          <p className="mt-1 mb-6 text-sm text-adm-fg-muted">
            Es la cuenta con todos los permisos. Después podés sumar a tu equipo desde Usuarios.
          </p>
          <SetupForm />
        </div>
      )}
    </AuthLayout>
  );
}
