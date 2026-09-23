import { AccountPageSkeleton, FormSkeleton } from "@/components/ui/skeletons";

/* Editor de planes: un panel por plan (precio, funciones, límites). */
export default function Loading() {
  return (
    <AccountPageSkeleton title="Planes" width="max-w-5xl" breadcrumb>
      <FormSkeleton sections={4} fields={4} />
    </AccountPageSkeleton>
  );
}
