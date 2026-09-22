"use client";

import { Copy, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePromotion, duplicatePromotion, setPromotionActive } from "@/app/admin/(panel)/promociones/actions";
import { toast } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";

export interface PromotionActionsProps {
  id: string;
  name: string;
  isActive: boolean;
  /** "row": menú "…" de la tabla. "header": botones en la cabecera del detalle. */
  variant?: "row" | "header";
}

export function PromotionActions({ id, name, isActive, variant = "row" }: PromotionActionsProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const res = await setPromotionActive(id, !isActive);
      if (!res.ok) return void toast.error(res.error);
      toast.success(isActive ? "Promoción pausada." : "Promoción activada.");
      router.refresh();
    });

  const duplicate = () =>
    startTransition(async () => {
      const res = await duplicatePromotion(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Promoción duplicada. Quedó pausada para que la revises.");
      router.push(`/admin/promociones/${res.data.id}`);
    });

  const remove = async () => {
    const res = await deletePromotion(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Promoción borrada.");
    if (variant === "header") router.push("/admin/promociones");
    else router.refresh();
  };

  const dialog = (
    <ConfirmDialog
      open={confirmDelete}
      onOpenChange={setConfirmDelete}
      title={`Borrar "${name}"`}
      description="Los precios de la tienda vuelven a mostrarse sin esta promoción. Los pedidos ya hechos no cambian."
      confirmLabel="Borrar promoción"
      destructive
      onConfirm={remove}
    />
  );

  if (variant === "header") {
    return (
      <>
        <Button onClick={toggle} loading={pending} icon={isActive ? <Pause aria-hidden /> : <Play aria-hidden />}>
          {isActive ? "Pausar" : "Activar"}
        </Button>
        <Button onClick={duplicate} disabled={pending} icon={<Copy aria-hidden />}>
          Duplicar
        </Button>
        <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending} icon={<Trash2 aria-hidden />}>
          Borrar
        </Button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <DropdownMenu
        trigger={
          <Button size="icon-sm" variant="ghost" aria-label={`Acciones de ${name}`} disabled={pending}>
            <MoreHorizontal aria-hidden />
          </Button>
        }
      >
        <DropdownItem href={`/admin/promociones/${id}`} icon={<Pencil aria-hidden />}>
          Editar
        </DropdownItem>
        <DropdownItem onSelect={toggle} icon={isActive ? <Pause aria-hidden /> : <Play aria-hidden />}>
          {isActive ? "Pausar" : "Activar"}
        </DropdownItem>
        <DropdownItem onSelect={duplicate} icon={<Copy aria-hidden />}>
          Duplicar
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={() => setConfirmDelete(true)} icon={<Trash2 aria-hidden />} danger>
          Borrar
        </DropdownItem>
      </DropdownMenu>
      {dialog}
    </>
  );
}
