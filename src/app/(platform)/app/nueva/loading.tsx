import { AuthLayout } from "@/app/admin/AuthLayout";
import { FieldsSkeleton } from "@/components/ui/skeletons";

/* Alta de tienda (paso 1): mismo marco que la página real + campos. */
export default function Loading() {
  return (
    <AuthLayout panelTitle="Tres pasos y tu tienda queda online, con un estilo pensado para tu rubro.">
      <FieldsSkeleton fields={3} />
    </AuthLayout>
  );
}
