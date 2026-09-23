import { FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Apariencia: panel de tema a la izquierda + preview de la tienda. */
export default function Loading() {
  return (
    <PageSkeleton title="Apariencia" tabs={2} actions={1}>
      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <FormSkeleton sections={3} fields={3} />
        <div className="sk hidden min-h-[640px] rounded-adm lg:block" aria-hidden />
      </div>
    </PageSkeleton>
  );
}
