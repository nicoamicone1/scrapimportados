import type { Theme } from "@/lib/theme";

import { LUNA_CSS } from "./custom-css";

/**
 * Tema a medida de la demo «Luna — ropa por fases» (taller de Palermo que saca
 * tiradas cortas por ciclo lunar). Es un `custom` armado sólo con lo que el
 * panel deja tocar: no se parece a ningún preset (difiere en ≥ 4 de los 10
 * ejes estructurales de cada uno; lo protege `theme.test.ts`) y el resto de la
 * identidad la pone `LUNA_CSS` (CSS personalizado, < 20 KB).
 *
 * Por qué cada decisión:
 * - Colores: luz de luna fría (lavanda plateada, no el blanco roto cálido de
 *   Atelier) con tinta noche como texto y primario. Los valores del brief pasan
 *   los mismos mínimos de `presets.test.ts` (texto 14,5:1; muted 5,9:1 y 4,9:1
 *   sobre la banda lavanda; acento 4,7:1 sobre el fondo). Peligro es un ciruela
 *   (#9E2650) para no confundirse con el rojo «luna de sangre» del acento
 *   (ΔE OKLab 0,094). El amarillo luna (#F2D76B) no es un rol del tema: vive en
 *   el CSS y sólo sobre fondo noche.
 * - Tipografía: Instrument Serif 400 (display fino y apretado, tracking tight)
 *   para títulos; Karla para el cuerpo: grotesca de rasgos propios (la «g» y la
 *   «y» le dan voz de marca chica) que no compite con la serif. Schibsted ya es
 *   el cuerpo de Editorial y es más de diario; Karla con Instrument es un par
 *   que no usa ningún preset.
 * - Botones pill y en mayúscula: además de la píldora, `uppercase` emite
 *   `data-btn-upper` y vuelve el menú etiquetas chicas espaciadas («FASE 02»).
 * - Header `pill`: una pastilla flotante, que el CSS rodea con una órbita fina
 *   y un satélite. No puede ser transparente (la pastilla tiene su fondo), así
 *   que `transparentOnHome` va apagado y el CSS la superpone al hero.
 * - Pie `statement`: el nombre gigante, que el CSS pone en una banda noche con
 *   una luna recortando las letras.
 * - style:
 *   · hero `cover`: la escena nocturna a sangre con el texto en la zona quieta.
 *   · titles `index`: el número de sección; el CSS le suma la fase lunar
 *     (nueva, creciente, llena, menguante, en ciclo).
 *   · shape `arch`: la ventana/medio círculo de la luna en categorías, banners,
 *     lookbook y fotos de las tarjetas.
 *   · card `tile`: baldosa lavanda con la foto en arco y el «+» redondo. Con
 *     ilustraciones 4:5 sobre fondo claro se lee mejor que `overlay`, cuyo velo
 *     negro y texto blanco ensuciarían el dibujo y taparían la prenda.
 *   · motion `lively`: marquesinas, escalonados y entradas por scroll.
 *   · grid `feature`: una prenda protagonista cada diez (tirada corta, vidriera).
 *   · filters `bar`: categorías en pastillas arriba (pocas categorías, mobile).
 *   · gallery `carousel`: la ficha como un rollo de ilustraciones a sangre.
 * - Imagen 4:5 (las ilustraciones del seed), radios `full`, sombras suaves
 *   (sólo la pastilla y los paneles flotantes), sin reglas entre celdas y con
 *   grano en las imágenes de campaña.
 */
export const LUNA_THEME: Theme = {
  preset: "custom",
  colors: {
    background: "#E9E7F0",
    surface: "#F5F4F8",
    text: "#15133A",
    textMuted: "#575473",
    primary: "#15133A",
    primaryText: "#F4F1E8",
    secondary: "#D6D2E6",
    accent: "#B33E27",
    border: "#C9C5DA",
    success: "#2C6249",
    danger: "#9E2650",
  },
  fonts: {
    heading: "instrument-serif",
    body: "karla",
    headingWeight: 400,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "tight",
    baseSize: 16,
  },
  radius: "full",
  buttons: { style: "solid", shape: "pill", uppercase: true },
  cards: { style: "flat", imageRatio: "4:5", hover: "zoom", showSku: false, showBrand: false, showTransferPrice: true, showNetPrice: true },
  header: { layout: "pill", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "comfortable", containerWidth: "normal", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "statement", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "cover", titles: "index", shape: "arch", card: "tile", motion: "lively", grid: "feature", filters: "bar", gallery: "carousel" },
  effects: { shadows: "soft", dividers: false, imageFilter: "grain" },
  custom_css: LUNA_CSS,
};
