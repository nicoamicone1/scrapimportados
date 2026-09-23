import { FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Precios masivos: asistente (alcance, cambio) | resumen. */
export default function Loading() {
  return (
    <PageSkeleton title="Precios" actions={1}>
      <FormSkeleton sections={2} fields={4} aside />
    </PageSkeleton>
  );
}
