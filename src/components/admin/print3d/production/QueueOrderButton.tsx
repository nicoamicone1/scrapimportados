"use client";

import { ListPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { queueOrder } from "@/app/admin/(panel)/taller-3d/cola/actions";
import { Button } from "@/components/ui/Button";

/** "Mandar a la cola" desde el detalle del pedido. */
export function QueueOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    const res = await queueOrder({ orderId });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const n = res.data.created;
    toast.success(`${n} ${n === 1 ? "trabajo" : "trabajos"} en la cola, sin impresora asignada.`);
    router.refresh();
  };
  return (
    <Button size="sm" variant="primary" icon={<ListPlus />} onClick={run} loading={pending} className="max-sm:h-11">
      Mandar a la cola
    </Button>
  );
}
