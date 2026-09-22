"use client";

import { Copy, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

function instructions(origin: string) {
  return [
    "Para sumarte al panel de la tienda:",
    "",
    `1. Pedile al dueño que te cree la cuenta (con "npm run create-admin" o desde Supabase > Authentication > Add user) con tu email.`,
    `2. Entrá a ${origin}/admin/login con ese email y la contraseña que te pasen.`,
    "3. Vas a ver «Tu cuenta espera aprobación» hasta que el dueño te apruebe y te asigne un rol en Usuarios.",
    "4. Cuando te apruebe, volvé a entrar y cambiá la contraseña en Usuarios > Mi cuenta.",
  ].join("\n");
}

/**
 * "Invitar": Ecommy v0 no manda emails ni tiene service-role key, así que no
 * puede crear usuarios desde el panel. Explica el flujo real y deja copiar
 * las instrucciones para mandárselas a la persona.
 */
export function InviteButton() {
  const [open, setOpen] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(instructions(window.location.origin));
      toast.success("Instrucciones copiadas.");
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  };

  return (
    <>
      <Button variant="primary" icon={<UserPlus />} onClick={() => setOpen(true)}>
        Invitar
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="Sumar a alguien al equipo"
        description="En esta versión las cuentas se crean fuera del panel y después se aprueban acá."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
            <Button variant="primary" icon={<Copy />} onClick={copy}>
              Copiar instrucciones
            </Button>
          </>
        }
      >
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>
            <span className="font-medium">Creá la cuenta.</span> Desde la terminal del proyecto:{" "}
            <code className="rounded-[4px] bg-adm-surface-2 px-1 font-mono text-xs">ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin</code>, o en
            Supabase, <span className="whitespace-nowrap">Authentication → Users → Add user</span> (marcá «Auto confirm user»).
          </li>
          <li>
            <span className="font-medium">Pasale el acceso.</span> La persona entra en <code className="font-mono text-xs">/admin/login</code> y ve «Tu
            cuenta espera aprobación».
          </li>
          <li>
            <span className="font-medium">Aprobala acá.</span> Aparece arriba, en «Por aprobar»: elegí su rol (Administrador o Staff) y tocá Aprobar.
          </li>
          <li>
            <span className="font-medium">Que cambie la contraseña</span> desde Usuarios → Mi cuenta.
          </li>
        </ol>
        <p className="mt-4 text-[13px] text-adm-fg-muted">
          La pantalla de alta (<code className="font-mono text-xs">/admin/setup</code>) sólo funciona cuando la tienda todavía no tiene dueño.
        </p>
      </Dialog>
    </>
  );
}
