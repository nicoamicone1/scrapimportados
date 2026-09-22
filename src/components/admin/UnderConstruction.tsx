import { PageHeader, EmptyState } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/Button";

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
