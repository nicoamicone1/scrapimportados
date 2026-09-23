import { Hammer } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/display";

/**
 * Placeholder de F para las secciones que construyen otros agentes.
 * Cada agente REEMPLAZA la `page.tsx` de su ruta (no este componente).
 */
export function UnderConstruction({
  title,
  description,
  owner,
}: {
  title: string;
  description: string;
  /** Agente responsable (sólo informativo). */
  owner: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={<Hammer />}
        title="En construcción"
        description={`Esta sección llega en la próxima entrega (agente ${owner}). Mientras tanto podés recorrer el resto del panel.`}
        actions={
          <>
            <ButtonLink href="/admin" variant="secondary">
              Ir al dashboard
            </ButtonLink>
            <ButtonLink href="/" external variant="ghost">
              Ver la tienda
            </ButtonLink>
          </>
        }
      />
    </>
  );
}
