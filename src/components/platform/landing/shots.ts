/*
 * Capturas reales del producto que usa la landing (BRAND §8, nivel 2).
 * Las genera `scripts/landing-shots.cjs` en `public/img/platform/` con estos
 * MISMOS tamaños (desktop 1280 × 800, celular 540 × 1169): si cambia el
 * panel o una tienda, se vuelve a correr el script y no hay que tocar nada
 * acá. Los marcos (`ShotFrame`) no dependen del contenido exacto.
 */

export interface Shot {
  src: string;
  width: number;
  height: number;
  alt: string;
}

const desktop = (name: string, alt: string): Shot => ({ src: `/img/platform/${name}.webp`, width: 1280, height: 800, alt });
const mobile = (name: string, alt: string): Shot => ({ src: `/img/platform/${name}.webp`, width: 540, height: 1169, alt });

export const SHOTS = {
  panelInicio: desktop("panel-inicio", "Inicio del panel de Ecommy: pedidos por confirmar, para despachar, pagos sin acreditar y stock bajo"),
  panelPedidos: desktop("panel-pedidos", "Lista de pedidos del panel con su estado de envío y de pago"),
  panelProductos: desktop("panel-productos", "Lista de productos del panel con precio, stock y estado"),
  panelApariencia: desktop("panel-apariencia", "Editor de apariencia con la vista previa de la tienda"),
  panelPedidosMobile: mobile("panel-pedidos-m", "Pedidos del panel en el celular"),
  tiendaDemo: desktop("tienda-demo", "Tienda demo hecha con Ecommy, en la computadora"),
  tiendaDemoMobile: mobile("tienda-demo-m", "Tienda demo hecha con Ecommy, en el celular"),
  tiendaLuna: desktop("tienda-luna", "Tienda de ejemplo Taller Luna, con el estilo Mercado"),
} as const satisfies Record<string, Shot>;
