import { formatPrice, isVariable } from "../lib/format";

export type Size = "sm" | "md" | "lg";

/**
 * Forma mínima que necesita este componente: sólo precios FINALES.
 * La cumplen tanto `Product` como `CatalogItem`.
 */
export type Priceable = {
  type: string;
  prices: {
    efectivo: { final: number };
    web: { final: number } | null;
  };
};

const HERO: Record<Size, string> = {
  sm: "text-lg sm:text-xl",
  md: "text-xl sm:text-2xl",
  lg: "text-3xl sm:text-4xl",
};

const LABEL: Record<Size, string> = {
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-xs",
};

const WEB: Record<Size, string> = {
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-sm",
};

/**
 * Precios FINALES (markup ya aplicado); el precio base del proveedor nunca
 * se expone al cliente.
 *
 * Diseño: apilados y sin wrap. "Efectivo" es el precio héroe (grande, bold,
 * color de acento) y "Precio web" queda abajo, chico y apagado, en una sola
 * línea. `whitespace-nowrap` + `tabular-nums` + espacio fino en `formatPrice`
 * evitan que el "$" caiga solo (ej. "$ 1.234.560").
 */
export default function PriceBlock({
  product,
  size = "sm",
  reserveWeb = false,
}: {
  product: Priceable;
  size?: Size;
  /**
   * Reserva la línea de "Precio web" aunque el producto no la tenga, para
   * que todas las tarjetas de una grilla midan exactamente lo mismo.
   */
  reserveWeb?: boolean;
}) {
  const desde = isVariable(product);
  const { efectivo, web } = product.prices;

  return (
    <div className="flex flex-col">
      <span
        className={`${LABEL[size]} font-bold uppercase tracking-wider text-muted`}
      >
        {desde ? "Efectivo desde" : "Efectivo"}
      </span>
      <span
        className={`${HERO[size]} font-extrabold leading-tight tracking-tight whitespace-nowrap tabular-nums text-accent-700`}
      >
        {formatPrice(efectivo.final)}
      </span>

      {web ? (
        <span
          className={`${WEB[size]} mt-0.5 whitespace-nowrap tabular-nums text-muted`}
        >
          Precio web{" "}
          <span className="font-semibold text-ink-soft">
            {formatPrice(web.final)}
          </span>
        </span>
      ) : (
        reserveWeb && (
          <span className={`${WEB[size]} mt-0.5`} aria-hidden="true">
            &nbsp;
          </span>
        )
      )}
    </div>
  );
}
