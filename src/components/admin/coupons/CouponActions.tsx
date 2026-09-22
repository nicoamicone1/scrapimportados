"use client";

import { Copy, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteCoupon, duplicateCoupon, setCouponActive } from "@/app/admin/(panel)/cupones/actions";
import { toast } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Tooltip } from "@/components/ui/Tooltip";

export interface CouponActionsProps {
  id: string;
  code: string;
  isActive: boolean;
  usesCount: number;
  variant?: "row" | "header";
}

const USED_HINT = "Ya se usó: desactivalo en lugar de borrarlo.";

export function CouponActions({ id, code, isActive, usesCount, variant = "row" }: CouponActionsProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const used = usesCount > 0;

  const toggle = () =>
    startTransition(async () => {
      const res = await setCouponActive(id, !isActive);
      if (!res.ok) return void toast.error(res.error);
      toast.success(isActive ? `Cupón ${code} pausado.` : `Cupón ${code} activado.`);
      router.refresh();
    });

  const duplicate = () =>
    startTransition(async () => {
      const res = await duplicateCoupon(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Se creó ${res.data.code}, pausado para que lo revises.`);
      router.push(`/admin/cupones/${res.data.id}`);
    });

  const remove = async () => {
    const res = await deleteCoupon(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Cupón ${code} borrado.`);
    if (variant === "header") router.push("/admin/cupones");
    else router.refresh();
  };

  const dialog = (
    <ConfirmDialog
      open={confirmDelete}
      onOpenChange={setConfirmDelete}
      title={`Borrar el cupón ${code}`}
      description="Deja de funcionar en el checkout. No se puede deshacer."
      confirmLabel="Borrar cupón"
      destructive
      onConfirm={remove}
    />
  );

  if (variant === "header") {
    const deleteButton = (
      <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending || used} icon={<Trash2 aria-hidden />}>
        Borrar
      </Button>
    );
    return (
      <>
        <Button onClick={toggle} loading={pending} icon={isActive ? <Pause aria-hidden /> : <Play aria-hidden />}>
          {isActive ? "Pausar" : "Activar"}
        </Button>
        <Button onClick={duplicate} disabled={pending} icon={<Copy aria-hidden />}>
          Duplicar
        </Button>
        {used ? (
          <Tooltip content={USED_HINT}>
            <span tabIndex={0} className="inline-flex rounded-adm">
              {deleteButton}
            </span>
          </Tooltip>
        ) : (
          deleteButton
        )}
        {dialog}
      </>
    );
  }

  return (
    <>
      <DropdownMenu
        trigger={
          <Button size="icon-sm" variant="ghost" aria-label={`Acciones de ${code}`} disabled={pending}>
            <MoreHorizontal aria-hidden />
          </Button>
        }
      >
        <DropdownItem href={`/admin/cupones/${id}`} icon={<Pencil aria-hidden />}>
          Editar
        </DropdownItem>
        <DropdownItem onSelect={toggle} icon={isActive ? <Pause aria-hidden /> : <Play aria-hidden />}>
          {isActive ? "Pausar" : "Activar"}
        </DropdownItem>
        <DropdownItem onSelect={duplicate} icon={<Copy aria-hidden />}>
          Duplicar
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={() => setConfirmDelete(true)} icon={<Trash2 aria-hidden />} danger disabled={used}>
          {used ? "Borrar (ya se usó)" : "Borrar"}
        </DropdownItem>
      </DropdownMenu>
      {dialog}
    </>
  );
}
