"use client";

import { Ellipsis, Eye, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { resyncImportJob } from "@/app/admin/(panel)/importar/actions";
import { Button, DropdownItem, DropdownMenu, toast } from "@/components/ui";
import { withPendingToast } from "@/components/ui/feedback";

/** Menú "…" de una fila del historial. */
export function JobRowActions({ jobId, canResync }: { jobId: string; canResync: boolean }) {
  const router = useRouter();
  return (
    <DropdownMenu
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Acciones de la importación">
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      <DropdownItem href={`/admin/importar/${jobId}`} icon={<Eye aria-hidden />}>
        Ver detalle
      </DropdownItem>
      {canResync ? (
        <DropdownItem
          icon={<RefreshCw aria-hidden />}
          onSelect={() =>
            void withPendingToast("Preparando la sincronización…", async () => {
              const r = await resyncImportJob(jobId);
              if (!r.ok) toast.error(r.error);
              else router.push(`/admin/importar/${r.data.jobId}`);
            })
          }
        >
          Volver a sincronizar
        </DropdownItem>
      ) : null}
    </DropdownMenu>
  );
}
