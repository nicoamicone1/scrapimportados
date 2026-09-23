import { AuthLayout } from "@/app/admin/AuthLayout";
import { FieldsSkeleton } from "@/components/ui/skeletons";

/* Invitación a un equipo: marco de auth + datos de la invitación. */
export default function Loading() {
  return (
    <AuthLayout panelTitle="Te sumaron a un equipo en Ecommy.">
      <FieldsSkeleton fields={2} />
    </AuthLayout>
  );
}
