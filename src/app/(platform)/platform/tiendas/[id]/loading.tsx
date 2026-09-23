import { AccountPageSkeleton, FormSkeleton } from "@/components/ui/skeletons";

/* Detalle de tienda (superadmin): plan, estado, trial y miembros. */
export default function Loading() {
  return (
    <AccountPageSkeleton breadcrumb>
      <FormSkeleton sections={3} fields={3} />
    </AccountPageSkeleton>
  );
}
