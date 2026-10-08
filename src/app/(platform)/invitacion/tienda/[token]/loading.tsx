import { AccountAside, AccountShell } from "@/components/platform/AccountShell";
import { FieldsSkeleton } from "@/components/ui/skeletons";

/* Recibir una tienda: marco de auth + datos del traspaso. */
export default function Loading() {
  return (
    <AccountShell aside={<AccountAside eyebrow="Te pasan una tienda" title="Una tienda lista, a tu nombre." />}>
      <FieldsSkeleton fields={2} />
    </AccountShell>
  );
}
