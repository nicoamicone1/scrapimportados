import { AccountShell } from "@/components/platform/AccountShell";
import { FieldsSkeleton } from "@/components/ui/skeletons";

/* Alta de tienda (paso 1): mismo marco que la página real + campos. */
export default function Loading() {
  return (
    <AccountShell wide>
      <div className="max-w-[600px]">
        <FieldsSkeleton fields={3} />
      </div>
    </AccountShell>
  );
}
