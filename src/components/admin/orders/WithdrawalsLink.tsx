import { Undo2 } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";

/**
 * Acceso a la bandeja de arrepentimientos desde el encabezado de Pedidos,
 * con la cantidad de solicitudes nuevas.
 */
export function WithdrawalsLink({ count }: { count: number }) {
  return (
    <ButtonLink href="/admin/pedidos/arrepentimientos" icon={<Undo2 />}>
      Arrepentimientos
      {count ? (
        <span className="tnum ml-0.5 rounded-[4px] bg-[#F5EAD3] px-1 text-[11px] font-medium text-[#7A4A00]">
          {count}
          <span className="sr-only"> {count === 1 ? "nueva" : "nuevas"}</span>
        </span>
      ) : null}
    </ButtonLink>
  );
}
