"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { ActionResult } from "@/lib/actions";
import { purgeConfirmMatches } from "@/lib/admin/purge-paths";

/**
 * Confirmación para borrar una tienda para siempre: hay que escribir su
 * dirección. Lo usan /platform (superadmin) y Configuración (titular).
 */
export function DeleteStoreDialog({
  open,
  onOpenChange,
  storeName,
  slug,
  run,
  afterHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName: string;
  slug: string;
  run: (confirm: string) => Promise<ActionResult<{ name: string; storageWarning: string | null }>>;
  /** Adónde ir después de borrar (la tienda ya no existe). */
  afterHref: string;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = purgeConfirmMatches(typed, slug);

  const submit = () =>
    startTransition(async () => {
      const res = await run(typed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data.name} se borró para siempre.`);
      if (res.data.storageWarning) toast.warning(res.data.storageWarning);
      onOpenChange(false);
      router.replace(afterHref);
      router.refresh();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
      dismissable={!pending}
      title={`¿Borrar ${storeName} para siempre?`}
      description="Se borran los productos, las fotos, los pedidos, los clientes, las páginas y el equipo. No se puede deshacer."
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="danger" loading={pending} disabled={!matches} onClick={submit}>
            Borrar para siempre
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (matches && !pending) submit();
        }}
      >
        <Field label={`Escribí ${slug} para confirmar`}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={slug} />
        </Field>
      </form>
    </Dialog>
  );
}
