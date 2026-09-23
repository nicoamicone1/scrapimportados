import { FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Formulario de producto: datos, imágenes, variantes, SEO | estado, categorías. */
export default function Loading() {
  return (
    <PageSkeleton breadcrumb actions={2}>
      <FormSkeleton sections={4} fields={4} aside />
    </PageSkeleton>
  );
}
