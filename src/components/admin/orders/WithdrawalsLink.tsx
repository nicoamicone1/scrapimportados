import { Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Acceso a la bandeja de arrepentimientos desde el encabezado de Pedidos,
 * con la cantidad de solicitudes nuevas.
 */
export function WithdrawalsLink({ count }: { count: number }) {
  return (
    <ButtonLink href="/admin/pedidos/arrepentimientos" icon={<Undo2 />} className="max-sm:h-11">
      Arrepentimientos
      {count ? (
        <Badge tone="amber" dot={false} className="tnum ml-0.5 h-4 px-1 text-[11px]">
          {count}
          <span className="sr-only"> {count === 1 ? "nueva" : "nuevas"}</span>
        </Badge>
      ) : null}
    </ButtonLink>
  );
}
