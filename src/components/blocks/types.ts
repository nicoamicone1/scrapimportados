import type { ProductCardProps } from "@/components/store/ProductCard";
import type { ResolvedBlockData } from "@/lib/blocks/resolve";
import type { BlockOf, BlockType } from "@/lib/blocks/schema";
import type { Promotion } from "@/lib/pricing";
import type { Theme } from "@/lib/theme";

/**
 * Contexto que reciben todos los bloques (contrato con el storefront, S).
 * `data` sale de `resolveBlockData(blocks, promotions)`.
 */
export interface BlockContext {
  data: ResolvedBlockData;
  promotions: Promotion[];
  theme: Theme;
  /** % de descuento por transferencia (línea "con transferencia" de las cards). */
  transferPercent: number;
  /**
   * Props extra para cada `ProductCard` (precio neto, WhatsApp para agotados,
   * etiqueta de transferencia…). Las define el storefront (S) y se pasan tal cual.
   */
  cardProps?: Partial<Omit<ProductCardProps, "product" | "promotions" | "cards" | "priority" | "sizes">>;
  /** Zona horaria de la tienda (`store_settings.timezone`) para la cuenta regresiva. */
  timezone?: string;
  /** Sólo en el preview del admin: fuerza la imagen mobile/desktop (sin media queries). */
  device?: "mobile" | "desktop";
  /** Sólo en el preview del admin: momento "ahora" fijo para la cuenta regresiva. */
  now?: Date;
}

export interface BlockProps<T extends BlockType> {
  block: BlockOf<T>;
  ctx: BlockContext;
  /** Posición del bloque en la página (0 = primero: imágenes con prioridad). */
  index: number;
}
