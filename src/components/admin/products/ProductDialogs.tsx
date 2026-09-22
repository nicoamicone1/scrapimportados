"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Checkbox } from "@/components/ui/Input";
import { toast } from "sonner";

import { deleteProduct, duplicateProduct } from "@/app/admin/(panel)/productos/actions";

/** "Duplicar producto" con la opción de copiar las fotos. Navega a la copia. */
export function DuplicateProductDialog({
  product,
  onOpenChange,
}: {
  product: { id: string; name: string; imageCount?: number } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [images, setImages] = useState(true);
  const [pending, setPending] = useState(false);

  const run = async () => {
    if (!product) return;
    setPending(true);
    const res = await duplicateProduct(product.id, { images });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Copia creada como borrador", { description: "Completá SKU y stock antes de publicarla." });
    onOpenChange(false);
    router.push(`/admin/productos/${res.data.id}`);
  };

  return (
    <Dialog
      open={Boolean(product)}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title="Duplicar producto"
      description={product ? `Se crea «Copia de ${product.name}» como borrador, sin SKU, código de barras ni stock.` : undefined}
      dismissable={!pending}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={run} loading={pending}>
            Duplicar
          </Button>
        </>
      }
    >
      <Checkbox
        checked={images}
        onChange={(e) => setImages(e.target.checked)}
        label="Copiar las fotos"
        description="Se duplican los archivos: podés cambiar las fotos de la copia sin tocar el original."
      />
    </Dialog>
  );
}

/** Eliminar definitivamente (sólo productos archivados sin pedidos). */
export function DeleteProductDialog({
  product,
  onOpenChange,
  onDeleted,
}: {
  product: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  return (
    <ConfirmDialog
      open={Boolean(product)}
      onOpenChange={onOpenChange}
      destructive
      title="Eliminar producto"
      description={
        product
          ? `«${product.name}» se borra para siempre, con sus variantes, fotos e historial de stock. No se puede deshacer.`
          : undefined
      }
      confirmLabel="Eliminar definitivamente"
      onConfirm={async () => {
        if (!product) return;
        const res = await deleteProduct(product.id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Producto eliminado");
        onDeleted?.();
      }}
    />
  );
}
