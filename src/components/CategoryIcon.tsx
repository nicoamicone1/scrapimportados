/**
 * Iconos SVG inline para las categorías (sin librerías).
 * El icono se elige por palabra clave del slug/nombre; si no hay match,
 * cae al icono genérico "tag".
 */

import { normalizeText } from "../lib/format";

export type IconName =
  | "speaker"
  | "headphones"
  | "mic"
  | "watch"
  | "phone"
  | "laptop"
  | "kitchen"
  | "home"
  | "toy"
  | "tool"
  | "bulb"
  | "sparkle"
  | "dumbbell"
  | "paw"
  | "car"
  | "bike"
  | "tent"
  | "plug"
  | "battery"
  | "tv"
  | "drone"
  | "camera"
  | "gift"
  | "sun"
  | "box"
  | "spray"
  | "book"
  | "backpack"
  | "cup"
  | "shirt"
  | "signal"
  | "gamepad"
  | "remote"
  | "chair"
  | "trophy"
  | "chip"
  | "shield"
  | "scissors"
  | "percent"
  | "tag";

/* Cada icono es un fragmento pensado para un viewBox 0 0 24 24, sin fill. */
const PATHS: Record<IconName, React.ReactNode> = {
  speaker: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <circle cx="12" cy="15" r="3.5" />
      <circle cx="12" cy="6.5" r="1.2" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="2.5" y="13.5" width="4" height="7" rx="2" />
      <rect x="17.5" y="13.5" width="4" height="7" rx="2" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4M8 22h8" />
    </>
  ),
  watch: (
    <>
      <rect x="7" y="6" width="10" height="12" rx="3" />
      <path d="M9 6V3h6v3M9 18v3h6v-3M12 10v2.5l1.5 1" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M10 18.5h4" />
    </>
  ),
  laptop: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M2 19h20" />
    </>
  ),
  kitchen: (
    <>
      <path d="M3 9h18" />
      <path d="M5 9v7a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4V9" />
      <path d="M9.5 6c0-1.5 1.5-1.5 1.5-3M14 6c0-1.5 1.5-1.5 1.5-3" />
    </>
  ),
  home: (
    <>
      <path d="m3 10.5 9-7 9 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  toy: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="4" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  tool: (
    <>
      <path d="M21 4.5 17.5 8 16 6.5 19.5 3a5 5 0 0 0-6.4 6.4l-8.4 8.4a1.8 1.8 0 0 0 2.5 2.5l8.4-8.4A5 5 0 0 0 21 4.5z" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z" />
    </>
  ),
  sparkle: (
    <>
      <path d="m11 2.5 1.7 4.8 4.8 1.7-4.8 1.7L11 15.5 9.3 10.7 4.5 9l4.8-1.7z" />
      <path d="m17.5 14.5.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </>
  ),
  dumbbell: (
    <>
      <rect x="2" y="9" width="3" height="6" rx="1" />
      <rect x="19" y="9" width="3" height="6" rx="1" />
      <rect x="7" y="10" width="10" height="4" rx="1" />
      <path d="M5 12h2M17 12h2" />
    </>
  ),
  paw: (
    <>
      <circle cx="7" cy="8" r="2" />
      <circle cx="12" cy="6.2" r="2" />
      <circle cx="17" cy="8" r="2" />
      <path d="M12 11c3 0 5.5 2.4 5.5 4.7 0 1.9-1.6 3.3-3.4 2.9a9 9 0 0 0-4.2 0c-1.8.4-3.4-1-3.4-2.9C6.5 13.4 9 11 12 11z" />
    </>
  ),
  car: (
    <>
      <path d="M3 16v-3.2c0-.3.1-.6.2-.9l1.9-3.8A2 2 0 0 1 6.9 7h10.2a2 2 0 0 1 1.8 1.1l1.9 3.8c.1.3.2.6.2.9V16z" />
      <path d="M4 16v2.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V16M17 16v2.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V16" />
      <path d="M3.5 12.5h17" />
    </>
  ),
  bike: (
    <>
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M5.5 17 10 7h4.5l4 10" />
      <path d="M9 7h4" />
    </>
  ),
  tent: (
    <>
      <path d="m12 3 9 17H3z" />
      <path d="M12 3v17" />
      <path d="m12 12 5 8" />
    </>
  ),
  plug: (
    <>
      <path d="M9 2v6M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 17v5" />
    </>
  ),
  battery: (
    <>
      <rect x="2" y="7" width="17" height="10" rx="2.5" />
      <path d="M21.5 10.5v3" />
      <path d="M6 10v4M9.5 10v4M13 10v4" />
    </>
  ),
  tv: (
    <>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="m8 21 4-4 4 4" />
    </>
  ),
  drone: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M10.2 10.2 7 7M13.8 10.2 17 7M10.2 13.8 7 17M13.8 13.8 17 17" />
      <circle cx="5" cy="5" r="2.5" />
      <circle cx="19" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
      <path d="M12 8v13" />
      <path d="M12 8c-3 0-4.5-.9-4.5-2.4S9 3 10 4s2 4 2 4zM12 8c3 0 4.5-.9 4.5-2.4S15 3 14 4s-2 4-2 4z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </>
  ),
  box: (
    <>
      <path d="m3 7 9-4 9 4-9 4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </>
  ),
  spray: (
    <>
      <rect x="7" y="8" width="8" height="13" rx="2" />
      <path d="M9 8V4h4v4" />
      <path d="M13 5h3l2-2" />
      <path d="M19 6h.01M21 3.5h.01M19.5 9h.01" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  backpack: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <rect x="9" y="13" width="6" height="4" rx="1" />
    </>
  ),
  cup: (
    <>
      <path d="M7 3h10l-1 18a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" />
      <path d="M7.4 8h9.2" />
    </>
  ),
  shirt: (
    <>
      <path d="M8 3 4 5.5 6 10l2-1v12h8V9l2 1 2-4.5L16 3l-2 2h-4z" />
    </>
  ),
  signal: (
    <>
      <path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
      <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  gamepad: (
    <>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <path d="M7 10.5v3M5.5 12h3" />
      <circle cx="16" cy="11" r="1" />
      <circle cx="18.5" cy="13.5" r="1" />
    </>
  ),
  remote: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="3" />
      <circle cx="12" cy="6" r="1.5" />
      <path d="M10 11h.01M14 11h.01M10 14h.01M14 14h.01M10 17h.01M14 17h.01" />
    </>
  ),
  chair: (
    <>
      <path d="M6 3h12v9H6z" />
      <path d="M4 12h16" />
      <path d="M7 12v9M17 12v9" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 3h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5H5v1a3 3 0 0 0 3 3M16 5h3v1a3 3 0 0 1-3 3" />
      <path d="M12 12v5" />
      <path d="M8.5 21h7l-1-4h-5z" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 2v5M14 2v5M10 17v5M14 17v5M2 10h5M2 14h5M17 10h5M17 14h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 5 5.5v6c0 4.3 2.9 8.3 7 10 4.1-1.7 7-5.7 7-10v-6z" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="6" cy="17" r="2.5" />
      <path d="M8.2 8.5 20 18M8.2 15.5 20 6" />
    </>
  ),
  percent: (
    <>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
      <path d="M19 5 5 19" />
    </>
  ),
  tag: (
    <>
      <path d="M3 11.5V4a1 1 0 0 1 1-1h7.5c.3 0 .5.1.7.3l8.5 8.5a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 12.2a1 1 0 0 1-.3-.7z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
};

/**
 * Reglas keyword -> icono. El orden importa: gana la primera que matchea
 * (ej. "cargadores-auto" es un cargador, no un auto).
 */
const RULES: [RegExp, IconName][] = [
  [/auricular|headphone/, "headphones"],
  [/parlante|audio|speaker/, "speaker"],
  [/microfono|mic\b/, "mic"],
  [/smartwatch|reloj/, "watch"],
  [/cargador|prolongador|adaptador|cable/, "plug"],
  [/power[- ]?bank|pila|bateria/, "battery"],
  [/bici/, "bike"],
  [/auto\b|automovil/, "car"],
  [/celular|soportes-celular|accesorios/, "phone"],
  [/computacion|pcs|notebook|laptop/, "laptop"],
  [/tv|proyector|televis/, "tv"],
  [/drone/, "drone"],
  [/camara|camera/, "camera"],
  [/consola|joystick|gamer/, "gamepad"],
  [/control[- ]?remoto/, "remote"],
  [/silla/, "chair"],
  [/radio/, "signal"],
  [/tecnologia|electronica/, "chip"],
  [/seguridad|alarma/, "shield"],
  [/cocina|electrodomestico|linea-blanca/, "kitchen"],
  [/herramienta|ferreteria|cerrajeria/, "tool"],
  [/ilumina|lampara|luz/, "bulb"],
  [/planchita|secador|cortapelo|barba|afeit/, "scissors"],
  [/belleza|skincare|cuidado|manicure|pedicure|masajea|perfum/, "sparkle"],
  [/deporte|fitness|gym/, "dumbbell"],
  [/mascota/, "paw"],
  [/camping|caza|pesca/, "tent"],
  [/juguet/, "toy"],
  [/limpieza/, "spray"],
  [/libreria|libro|escolar/, "book"],
  [/marroquineria|mochila|bolso/, "backpack"],
  [/termo|mate|vaso|taza/, "cup"],
  [/indumentaria|ropa|remera/, "shirt"],
  [/organiza/, "box"],
  [/navidad/, "gift"],
  [/temporada|verano|playa/, "sun"],
  [/mundial|futbol|deportiv/, "trophy"],
  [/oferta|promo|descuento/, "percent"],
  [/hogar|bazar|deco|blanqueria|blanquearia|bano|griferia|espejo|mueble/, "home"],
];

export function pickIcon(slug: string, name = ""): IconName {
  const haystack = normalizeText(`${slug} ${name}`);
  for (const [re, icon] of RULES) {
    if (re.test(haystack)) return icon;
  }
  return "tag";
}

export default function CategoryIcon({
  slug,
  name,
  className = "h-6 w-6",
}: {
  slug: string;
  name?: string;
  className?: string;
}) {
  const icon = pickIcon(slug, name);

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[icon]}
    </svg>
  );
}
