import { AccountPageSkeleton, CardsSkeleton } from "@/components/ui/skeletons";

/* Mis tiendas: header de cuenta + grilla de tarjetas de tienda. */
export default function Loading() {
  return (
    <AccountPageSkeleton title="Mis tiendas">
      <CardsSkeleton count={3} gridClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3" />
    </AccountPageSkeleton>
  );
}
