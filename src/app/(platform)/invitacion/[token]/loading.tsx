import { AccountAside, AccountShell } from "@/components/platform/AccountShell";
import { FieldsSkeleton } from "@/components/ui/skeletons";

/* Invitación a un equipo: marco de auth + datos de la invitación. */
export default function Loading() {
  return (
    <AccountShell aside={<AccountAside eyebrow="Invitación" title="Te sumaron a un equipo en Ecommy." />}>
      <FieldsSkeleton fields={2} />
    </AccountShell>
  );
}
