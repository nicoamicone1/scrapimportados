import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/display";

/** Pantalla para roles sin acceso a una sección (ver src/lib/admin/permissions.ts). */
export function NoPermission({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        title="Sin permisos"
        description={
          description ??
          "Tu rol no tiene acceso a esta sección. Si necesitás cambiar algo, pedíselo al dueño o a un administrador de la tienda."
        }
        actions={
          <ButtonLink href="/admin" variant="secondary">
            Ir al dashboard
          </ButtonLink>
        }
      />
    </>
  );
}
