import { FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Zona de envío: alcance (mapa), costo y reglas + barra de guardar. */
export default function Loading() {
  return (
    <PageSkeleton breadcrumb actions={1}>
      <FormSkeleton sections={3} fields={3} saveBar />
    </PageSkeleton>
  );
}
