"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { purgeActiveStore } from "@/app/admin/(panel)/configuracion/borrar-actions";
import { DeleteStoreDialog } from "@/components/admin/DeleteStoreDialog";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";

/** Configuración › «Borrar la tienda» (sólo quien la tiene a su nombre o el superadmin). */
export function DeleteStoreCard({ storeName, slug }: { storeName: string; slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-medium tracking-[0.06em] text-adm-danger uppercase">Zona de peligro</h2>
      <Card>
        <CardHeader
          title="Borrar la tienda"
          description="Se borra para siempre con todo lo cargado: productos, fotos, pedidos, clientes, páginas y equipo. Si querés que la siga otra persona, pasásela desde Usuarios."
          actions={
            <Button variant="danger" icon={<Trash2 />} onClick={() => setOpen(true)}>
              Borrar la tienda
            </Button>
          }
        />
      </Card>
      <DeleteStoreDialog open={open} onOpenChange={setOpen} storeName={storeName} slug={slug} run={(confirm) => purgeActiveStore({ confirm })} afterHref="/app" />
    </section>
  );
}
