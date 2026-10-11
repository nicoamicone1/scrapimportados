/**
 * CSS personalizado de la demo Luna: lo que haría el diseñador de la marca con
 * el campo «CSS personalizado» del panel (máx. 20 KB, sin @import ni url() a
 * terceros). Se emite crudo después de las variables del tema, fuera de las
 * capas de la plataforma: por eso TODO selector va prefijado con `.store-root`
 * (no toca nada fuera de la tienda) y casi todo cuelga de los `data-*` del
 * tema, así que si el dueño cambia de títulos, forma o tarjeta, la regla deja
 * de aplicar en vez de romper.
 *
 * Sistema: el ciclo lunar. Fases dibujadas con CSS (● nueva, ◐ creciente,
 * ○ llena, ◑ menguante) como índice de secciones, separadores, filtros y
 * acordeones; bandas noche con estrellas y grano (único lugar del amarillo
 * luna); órbitas de 1 px como ornamento. Movimiento sólo con
 * `prefers-reduced-motion: no-preference`; con `reduce` se apaga todo.
 */
export const LUNA_CSS = `/* Luna — ropa por fases · CSS de marca */
.store-root {
  --luna-cream: #F4F1E8;
  --luna-gold: #F2D76B;
  --luna-stars:
    radial-gradient(circle at 12% 22%, rgb(244 241 232 / .85) 0 1px, transparent 1.6px) 0 0 / 241px 197px,
    radial-gradient(circle at 68% 58%, rgb(244 241 232 / .6) 0 1px, transparent 1.6px) 0 0 / 331px 269px,
    radial-gradient(circle at 27% 61%, rgb(244 241 232 / .5) 0 .9px, transparent 1.4px) 0 0 / 389px 313px,
    radial-gradient(circle at 38% 84%, rgb(244 241 232 / .35) 0 .8px, transparent 1.3px) 0 0 / 157px 173px,
    radial-gradient(circle at 91% 37%, rgb(244 241 232 / .3) 0 .7px, transparent 1.2px) 0 0 / 211px 283px,
    radial-gradient(circle at 84% 12%, rgb(242 215 107 / .8) 0 1.2px, transparent 2px) 0 0 / 523px 409px;
  --luna-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  accent-color: var(--primary);
}

/* ---------- Básicos: selección, foco, scroll ---------- */
.store-root ::selection { background: var(--primary); color: var(--luna-cream); }
.store-root :is(.blk-bg-primary, .ftr-statement) ::selection { background: var(--luna-gold); color: var(--primary); }
.store-root :focus-visible { outline: 2px solid var(--fg); outline-offset: 3px; }
.store-root .blk-on-image :focus-visible { outline-color: var(--luna-cream); }
.store-root [class*="overflow-y-auto"] { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }

/* ---------- Tipografía: serif apretada, etiquetas espaciadas ---------- */
.store-root :is(.blk-eyebrow, .st-head-eyebrow, .eyebrow) { letter-spacing: .24em; font-weight: 600; }
.store-root :is(.blk-hero-title, .blk-display, .blk-look-word, .blk-catlist-name, .blk-quote-text) { letter-spacing: -.025em; }
.store-root .blk-title { line-height: 1; }

/* ---------- Bandas noche: estrellas finas + grano ---------- */
.store-root :is(.blk-bg-primary, .ftr-statement) {
  position: relative;
  isolation: isolate;
  background: var(--luna-stars), var(--primary);
}
/* En las tiras finas las estrellas parecen polvo: sólo grano. */
.store-root .blk-bg-primary.blk-pad-none { background: var(--primary); }
.store-root :is(.blk-bg-primary, .ftr-statement)::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--luna-grain);
  opacity: .1;
  mix-blend-mode: screen;
}
.store-root .blk-bg-primary :is(.blk-eyebrow, .blk-marquee-sep) { color: var(--luna-gold); }
.store-root .blk-bg-primary .blk-cd-unit > :last-child { color: var(--luna-gold); }
/* Las baldosas de producto son claras: adentro de la banda vuelven a la tinta. */
.store-root .blk-bg-primary .pcard {
  --fg: var(--theme-fg);
  --fg-muted: var(--theme-fg-muted);
  --accent: var(--theme-accent);
  --border: var(--theme-border);
  color: var(--fg);
}

/* ---------- Anuncio: tira noche con fases doradas ---------- */
.store-root .store-announce {
  background-color: var(--primary);
  color: var(--luna-cream);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .2em;
  text-transform: uppercase;
}
.store-root .store-announce .st-marquee-track > span::before {
  content: "";
  display: inline-block;
  width: .9em;
  height: .9em;
  margin-right: 1.5em;
  vertical-align: -.12em;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--luna-gold);
}
.store-root .store-announce .st-marquee-track > span:nth-child(4n + 1)::before { background: var(--luna-gold); }
.store-root .store-announce .st-marquee-track > span:nth-child(4n + 2)::before { background: linear-gradient(90deg, var(--luna-gold) 50%, transparent 0); }
.store-root .store-announce .st-marquee-track > span:nth-child(4n)::before { background: linear-gradient(90deg, transparent 50%, var(--luna-gold) 0); }

/* ---------- Header pastilla: órbita fina y un satélite ---------- */
.store-root .hdr-pill {
  position: relative;
  outline: 1px solid color-mix(in oklab, var(--border-strong) 70%, transparent);
  outline-offset: 5px;
}
.store-root .hdr-pill::after { content: none; }
@supports (offset-path: inset(0 round 1px)) {
  .store-root .hdr-pill::after {
    content: "";
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 0 0 1.25px var(--fg);
    offset-path: inset(-6px round 9999px);
    offset-distance: 22%;
    offset-rotate: 0deg;
    pointer-events: none;
  }
}
.store-root .hdr-logo-text { letter-spacing: -.02em; }
/* Si la página abre con noche (escena a sangre o banda primaria), la pastilla flota en ella. */
.store-root:has(#contenido > .blk:first-of-type .blk-hero[data-layout="cover"]) .store-header[data-layout="pill"] {
  margin-bottom: calc(-1 * var(--header-sticky-h));
}
.store-root:has(#contenido > .blk:first-of-type > .blk-bg-primary) .store-header[data-layout="pill"]:not([data-scrolled="1"]) {
  background: var(--primary);
}
.store-root .store-header[data-layout="pill"] .hdr-pill { color: var(--theme-fg); }
/* Links del menú: una luna que crece al pasar el mouse (llena en la página actual). */
.store-root .hdr-nav .nav-link { position: relative; background-image: none; }
.store-root .hdr-nav .nav-link::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 3px;
  width: 7px;
  height: 7px;
  margin-left: -3.5px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px currentColor, inset 2px 0 0 currentColor;
  opacity: 0;
  transform: scale(.4);
  transition: opacity var(--st-dur-2) var(--st-ease), transform var(--st-dur-2) var(--st-ease-spring), box-shadow 420ms var(--st-ease);
}
.store-root .hdr-nav .nav-link:is(:hover, :focus-visible, [aria-current="page"])::before {
  opacity: 1;
  transform: none;
  box-shadow: inset 0 0 0 1px currentColor, inset 7px 0 0 currentColor;
}
.store-root .hdr-nav .nav-link:not(.st-link):is(:hover, [aria-current="page"]) { text-decoration: none; }

/* ---------- Títulos «index»: la fase lunar numera las secciones ---------- */
.store-root[data-titles="index"] .blk-sectitle {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  column-gap: .6rem;
  font-size: clamp(2rem, 4.6cqi, 3.75rem);
  line-height: .95;
}
.store-root[data-titles="index"] .blk-sectitle > span { grid-row: 2; grid-column: 1 / -1; margin-top: .4em; }
.store-root[data-titles="index"] .blk-sectitle::before {
  content: "";
  grid-row: 1;
  grid-column: 1;
  width: 13px;
  min-width: 0;
  height: 13px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.25px currentColor;
}
.store-root[data-titles="index"] .blk-sectitle::after {
  content: var(--sec-label, "");
  grid-row: 1;
  grid-column: 2;
  padding-right: 3rem;
  background: linear-gradient(currentColor, currentColor) right center / 2.25rem 1px no-repeat;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: 1;
  letter-spacing: .2em;
  font-variant-numeric: tabular-nums;
}
.store-root[data-titles="index"] .blk:nth-child(4n + 1 of [data-sec]) .blk-sectitle::before { background: currentColor; }
.store-root[data-titles="index"] .blk:nth-child(4n + 2 of [data-sec]) .blk-sectitle::before { background: linear-gradient(90deg, currentColor 50%, transparent 0); }
.store-root[data-titles="index"] .blk:nth-child(4n of [data-sec]) .blk-sectitle::before { background: linear-gradient(90deg, transparent 50%, currentColor 0); }
/* Si el id del bloque nombra una fase («llena», «menguante»…), el índice la respeta. */
.store-root[data-titles="index"] .blk[data-sec][data-block-id*="nueva"] .blk-sectitle::before { background: currentColor; }
.store-root[data-titles="index"] .blk[data-sec][data-block-id*="creciente"] .blk-sectitle::before { background: linear-gradient(90deg, currentColor 50%, transparent 0); }
.store-root[data-titles="index"] .blk[data-sec][data-block-id*="llena"] .blk-sectitle::before { background: none; }
.store-root[data-titles="index"] .blk[data-sec][data-block-id*="menguante"] .blk-sectitle::before { background: linear-gradient(90deg, transparent 50%, currentColor 0); }
.store-root[data-titles="index"] .blk-bg-primary .blk-sectitle::before { color: var(--luna-gold); }
.store-root[data-titles="index"] .blk-head { align-items: flex-end; }
.store-root[data-titles="index"] .pdp-title { letter-spacing: -.03em; }

/* ---------- Portada: escena a sangre con horizonte curvo ---------- */
.store-root .blk-hero[data-layout="cover"] {
  border-radius: 0 0 50% 50% / 0 0 clamp(28px, 6vw, 96px) clamp(28px, 6vw, 96px);
}
.store-root .blk-hero[data-layout="cover"] .blk-hero-title {
  font-size: clamp(3rem, 8.4cqi, 9rem);
  line-height: .9;
  letter-spacing: -.03em;
}
.store-root .blk-on-image { color: var(--luna-cream); }
.store-root .blk-on-image .blk-eyebrow { color: var(--luna-gold); }
.store-root .blk-hero .blk-eyebrow::before {
  content: "";
  display: inline-block;
  width: .95em;
  height: .95em;
  margin-right: .75em;
  vertical-align: -.15em;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 .22em rgb(242 215 107 / .18);
}
.store-root .blk-hero-sub { max-width: 44ch; }
/* Mobile: aire bajo los botones para las burbujas flotantes (WhatsApp y selector, 56 px a 16 px del borde). */
@media (max-width: 639px) {
  .store-root .blk-hero[data-layout="cover"] .blk-hero-text { padding-bottom: 96px; }
}

/* ---------- Marquesina: serif enorme con fases como separador ---------- */
.store-root .blk-marquee[data-size="lg"] { font-size: clamp(2.75rem, 10cqi, 9rem); letter-spacing: -.03em; }
.store-root .blk-marquee[data-size="lg"] .blk-marquee-group { gap: 0 .45em; }
.store-root .blk-marquee[data-size="sm"] { font-size: var(--text-xs); letter-spacing: .2em; text-transform: uppercase; }
.store-root .blk-marquee-sep {
  width: .4em;
  height: .4em;
  border-radius: 50%;
  opacity: 1;
  transform: none;
  background: none;
  box-shadow: inset 0 0 0 max(1.25px, .03em) currentColor;
}
.store-root .blk-marquee[data-size="sm"] .blk-marquee-sep { width: .95em; height: .95em; }
.store-root .blk-marquee-sep:nth-child(8n + 2) { background: currentColor; }
.store-root .blk-marquee-sep:nth-child(8n + 4) { background: linear-gradient(90deg, currentColor 50%, transparent 0); }
.store-root .blk-marquee-sep:nth-child(8n) { background: linear-gradient(90deg, transparent 50%, currentColor 0); }

/* ---------- Tarjeta (tile): foto en arco, nombre en serif, sello de oferta ---------- */
.store-root[data-card="tile"] .pcard-name {
  min-height: 2.2em;
  font-family: var(--font-heading);
  font-weight: var(--heading-weight);
  font-size: calc(var(--base-size) * 1.3);
  line-height: 1.12;
  letter-spacing: -.01em;
}
.store-root[data-card="tile"]:not([data-motion="none"]) .pcard:hover .pcard-main { transform: scale(1.035); }
.store-root .pcard:hover .pcard-link { text-decoration: none; }
/* Órbita que aparece alrededor de la prenda. */
.store-root .pcard-media::after {
  content: "";
  position: absolute;
  z-index: 1;
  left: 50%;
  top: 46%;
  width: 72%;
  aspect-ratio: 1;
  border-radius: 50%;
  /* Dos tonos: se ve sobre prendas claras y oscuras. */
  border: 1px solid rgb(244 241 232 / .75);
  box-shadow: 0 0 0 1px rgb(21 19 58 / .3);
  opacity: 0;
  transform: translate(-50%, -50%) scale(.82);
  transition: opacity var(--st-dur-2) var(--st-ease), transform var(--st-dur-3) var(--st-ease);
  pointer-events: none;
}
.store-root .pcard:hover .pcard-media::after { opacity: 1; transform: translate(-50%, -50%); }
/* Eclipse: la segunda foto se revela con un círculo que se abre. */
.store-root .pcard[data-alt="1"] .pcard-alt {
  opacity: 1;
  clip-path: circle(0% at 50% 46%);
  transition: clip-path 700ms var(--st-ease);
}
.store-root .pcard[data-alt="1"]:hover .pcard-alt { clip-path: circle(85% at 50% 46%); }
/* Oferta: sello circular, girado, en rojo luna de sangre. */
.store-root .pcard-badge {
  top: auto;
  bottom: 10px;
  left: 10px;
  display: grid;
  place-items: center;
  width: 3.9rem;
  height: 3.9rem;
  padding: .45rem;
  border-radius: 50%;
  background: var(--accent);
  color: var(--luna-cream);
  box-shadow: inset 0 0 0 3px var(--accent), inset 0 0 0 4px rgb(244 241 232 / .7);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: .06em;
  text-align: center;
  text-transform: uppercase;
  transform: rotate(-14deg);
}
@media (min-width: 1024px) {
  .store-root :is(.store-grid[data-layout="feature"] > :is(:nth-child(10n + 1), :nth-child(10n + 7)), .blk-grid[data-highlight] > :first-child) .pcard-name { min-height: 0; font-size: calc(var(--base-size) * 2.25); }
}
.store-root .blk-arrow { width: 40px; height: 40px; border-radius: 50%; }

/* ---------- Categorías, lookbook, imagen y texto ---------- */
.store-root .blk-cat-name {
  font-family: var(--font-heading);
  font-weight: var(--heading-weight);
  font-size: var(--text-xl);
  line-height: 1.05;
  letter-spacing: -.01em;
}
.store-root :is(.blk-cat-frame, .blk-dot) {
  outline: 1px solid transparent;
  outline-offset: 6px;
  transition: outline-color var(--st-dur-2) var(--st-ease), outline-offset var(--st-dur-3) var(--st-ease);
}
.store-root :is(.blk-cat:hover .blk-cat-frame, .blk-dot-link:hover .blk-dot) {
  outline-color: var(--border-strong);
  outline-offset: 9px;
}
.store-root .blk[data-block="lookbook"] { overflow-x: clip; }
.store-root .blk-look-side .blk-title { font-size: clamp(2.25rem, 5cqi, 4.25rem); line-height: .95; }
/* Reseña grande: una creciente en lugar de las comillas. */
.store-root .blk-quote-mark {
  width: 2.25rem;
  height: 2.25rem;
  margin-bottom: 1.5rem;
  border-radius: 50%;
  font-size: 0;
  line-height: 0;
  color: var(--accent);
  box-shadow: inset .7rem -.3rem 0 0 currentColor;
}
.store-root .blk-bg-primary .blk-quote-mark { color: var(--luna-gold); }
.store-root .blk-look { position: relative; isolation: isolate; }
.store-root .blk-look::before {
  content: "";
  position: absolute;
  z-index: -1;
  left: -7%;
  top: -5%;
  width: min(82%, 780px);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  opacity: .6;
  pointer-events: none;
}
.store-root .blk-look[data-image="right"]::before { left: auto; right: -7%; }

/* ---------- Catálogo y ficha: fases como indicador ---------- */
.store-root .chip { border-radius: 9999px; }
.store-root .cat-pill::before {
  content: "";
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px currentColor;
  transition: box-shadow var(--st-dur-2) var(--st-ease);
}
.store-root .cat-pill:is(:hover, [aria-current="true"])::before { box-shadow: inset 0 0 0 5px currentColor; }
.store-root .st-head-title { letter-spacing: -.03em; }
.store-root[data-titles="index"] .st-head-title { font-size: clamp(2.5rem, 5.5vw, 4.75rem); line-height: .95; }

/* ---------- Preguntas: la luna se llena al abrir ---------- */
.store-root .blk-faq-sign {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.25px currentColor, inset 0 0 0 currentColor;
  transition: box-shadow 420ms var(--st-ease);
}
.store-root .blk-faq-sign::before,
.store-root .blk-faq-sign::after { content: none; }
.store-root .blk-faq summary:hover .blk-faq-sign { box-shadow: inset 0 0 0 1.25px currentColor, inset 4px 0 0 currentColor; }
.store-root .blk-faq details[open] .blk-faq-sign { box-shadow: inset 0 0 0 1.25px currentColor, inset 14px 0 0 currentColor; }

/* ---------- Pie statement: noche, horizonte curvo y una luna que recorta el nombre ---------- */
.store-root .ftr-statement {
  --fg: var(--luna-cream);
  --fg-muted: color-mix(in oklab, var(--luna-cream) 76%, var(--primary));
  --border: color-mix(in oklab, var(--luna-cream) 22%, var(--primary));
  overflow: hidden;
  padding-top: clamp(20px, 4vw, 56px);
  border-radius: 50% 50% 0 0 / clamp(28px, 6vw, 96px) clamp(28px, 6vw, 96px) 0 0;
  color: var(--fg);
}
.store-root .ftr-statement > .store-container:first-child { border-top-color: transparent; }
.store-root .ftr-statement .ftr-legal { border-top-color: var(--border); }
.store-root .ftr-giant {
  position: relative;
  isolation: isolate;
  width: fit-content;
  max-width: 100%;
  margin-inline: auto;
  font-size: min(calc((min(100vw, var(--container)) - 2 * var(--gutter)) * 2.75 / var(--chars, 8)), 30vw, 400px);
  letter-spacing: -.035em;
  /* Capa 1: las letras (tinta adentro de la luna, crema afuera). Capas 2 y 3: la luna y su halo, detrás. */
  background:
    radial-gradient(circle .37em at 74% 54%, var(--primary) 99%, var(--luna-cream) 100%),
    radial-gradient(circle .37em at 74% 54%, var(--luna-gold) 99%, transparent 100%),
    radial-gradient(circle .43em at 74% 54%, rgb(242 215 107 / .1) 99%, transparent 100%);
  -webkit-background-clip: text, border-box, border-box;
  background-clip: text, border-box, border-box;
  color: transparent;
}

/* ---------- Movimiento (sólo si la persona no pidió menos) ---------- */
@media (prefers-reduced-motion: no-preference) {
  .store-root[data-motion="lively"] .hdr-pill::after { animation: luna-orbit 48s linear infinite; }
}
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .store-root:not([data-motion="none"]) :is(.pcard-media, .blk-look-media, .blk-it-media, .blk-cat-frame) {
      animation: luna-eclipse linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 85%;
    }
  }
}
@keyframes luna-orbit {
  from { offset-distance: 22%; }
  to { offset-distance: 122%; }
}
@keyframes luna-eclipse {
  from { clip-path: circle(20% at 50% 46%); }
  to { clip-path: circle(86% at 50% 46%); }
}
@media (prefers-reduced-motion: reduce) {
  .store-root *,
  .store-root *::before,
  .store-root *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;
