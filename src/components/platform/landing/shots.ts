/*
 * Capturas reales del producto que todavía usa el sitio (BRAND §8, nivel 2).
 * Las genera `scripts/landing-shots.cjs` en `public/img/platform/` con estos
 * MISMOS tamaños (desktop 1280 × 800): si cambia el panel, se vuelve a correr
 * el script y no hay que tocar nada acá.
 *
 * Desde 2026-10 la tienda y el panel de la landing son maquetas en HTML con
 * la tienda de ropa de ejemplo, Luna Indumentaria (`StoreMock`,
 * `PanelScenes`): las capturas de la demo anterior (electro y bazar) se
 * borraron. Queda sólo la lista de pedidos de las pantallas de cuenta
 * (`PanelGlimpse`), que no muestra productos.
 */

export interface Shot {
  src: string;
  width: number;
  height: number;
  alt: string;
}

const desktop = (name: string, alt: string): Shot => ({ src: `/img/platform/${name}.webp`, width: 1280, height: 800, alt });

export const SHOTS = {
  panelPedidos: desktop("panel-pedidos", "Lista de pedidos del panel con su estado de envío y de pago"),
} as const satisfies Record<string, Shot>;
