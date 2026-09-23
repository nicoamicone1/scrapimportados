import { formatMoney } from "@/lib/money";
import { applyRounding } from "@/lib/pricing/bulk";
import { PRESET_LIST } from "@/lib/theme/presets";

import type { RedPiece, ScreenshotSlide } from "./types";

/*
 * Posts y reels de `docs/SOCIAL-KIT.md` §2 (P01…P15). El copy es el del kit;
 * si cambia allá, cambia acá (y al revés). Los reels se graban con la
 * pantalla real: estas placas son la portada vertical, la miniatura del
 * perfil y, en los carruseles, cada placa.
 */

export const HASHTAGS = ["#tiendaonline", "#emprendedoresargentinos", "#pymesargentinas"];

const IG_TT: RedPiece["channels"] = ["instagram", "tiktok"];
const BOTH: RedPiece["formats"] = ["feed", "story"];

/** Ejemplo de P05 calculado con el mismo motor que `/admin/precios` (+8 %, terminado en 990). */
const P05_BEFORE = [12000, 25000, 45900];
const P05_AFTER = P05_BEFORE.map((p) => applyRounding(p * 1.08, "end990"));

/** P08: orden y rubros del kit; la línea de cada estilo sale de su descripción real. */
const P08_STYLES: [id: string, rubros: string][] = [
  ["atelier", "Moda y joyería"],
  ["editorial", "Streetwear, marcas con actitud"],
  ["mercado", "Artesanías, deco, dietética"],
  ["nordico", "Electro, hogar, ferretería"],
  ["galpon", "Mayoristas, corralones, repuestos"],
  ["botica", "Farmacia y perfumería"],
  ["recreo", "Librería, juguetería"],
  ["lapacho", "Muebles e iluminación"],
  ["bodega", "Vinoteca, gourmet, café"],
  ["neon", "Gaming y audio"],
];

const P08_SLIDES: ScreenshotSlide[] = P08_STYLES.map(([id, rubros]) => {
  const preset = PRESET_LIST.find((p) => p.id === id);
  if (!preset) throw new Error(`Preset desconocido en el kit de redes: ${id}`);
  return {
    template: "captura",
    kicker: rubros,
    title: preset.name,
    body: preset.description,
    placeholder: `Pegá acá la captura de una tienda con ${preset.name}`,
  };
});

export const POSTS: RedPiece[] = [
  {
    id: "P01",
    kind: "reel",
    name: "Armo una tienda de cero, cronometrado",
    formats: BOTH,
    channels: IG_TT,
    days: [1, 22],
    hook: "Armo una tienda online desde cero. Cronómetro en pantalla.",
    caption:
      "Del registro a una tienda con 3 productos y el link listo para compartir: [tiempo real]. Sin tarjeta, 14 días de Pro. Después, si no pagás nada, pasás a Free y no perdés lo que cargaste.",
    cta: "Probá Pro 14 días, sin tarjeta. Link en la bio.",
    hashtags: HASHTAGS,
    check: "El tiempo del texto es el de la grabación, sin cortes. Si tarda 18 minutos, dice 18.",
    fields: [{ key: "tiempo", token: "[tiempo real]", label: "Tiempo real de la grabación", example: "18 minutos" }],
    slides: [
      { template: "gancho", title: "Armo una tienda online desde cero.", accent: "Cronómetro en pantalla." },
      {
        template: "dato",
        kicker: "Del registro a una tienda con 3 productos y el link listo para compartir",
        value: "[tiempo real]",
        body: "Sin tarjeta, 14 días de Pro.",
      },
    ],
  },
  {
    id: "P02",
    kind: "reel",
    name: "El pedido te llega armado a WhatsApp",
    formats: BOTH,
    channels: IG_TT,
    days: [2, 23],
    hook: "¿Cansada de preguntar “¿qué talle?” por WhatsApp?",
    caption:
      "Tus clientes siguen comprando por WhatsApp. La diferencia es que el pedido llega armado y queda registrado en tu panel, aunque después no te escriban.",
    cta: "Mirá la tienda demo y hacé un pedido de prueba: link en la bio.",
    hashtags: [...HASHTAGS, "#marcadeindumentaria"],
    check: "Grabado con la demo o con una tienda propia; el pedido de prueba se cancela después.",
    slides: [
      { template: "gancho", title: "¿Cansada de preguntar “¿qué talle?”", accent: "por WhatsApp?" },
      {
        template: "antes-despues",
        title: "El pedido te llega armado a WhatsApp.",
        before: { label: "Por chat", items: ["“¿Precio?”", "“¿Talle?”", "“¿Color?”"] },
        after: { label: "Desde la tienda", items: ["Producto, talle y color", "Total y dirección", "Link al pedido registrado"] },
      },
    ],
  },
  {
    id: "P03",
    kind: "carrusel",
    name: "Sin comisión por venta: cuánto te queda",
    formats: BOTH,
    channels: IG_TT,
    days: [3],
    hook: "Vendiste $ 100.000. ¿Cuánto te queda?",
    caption:
      "No cobramos comisión por venta: tu cliente te transfiere a tu cuenta o lo acuerdan por WhatsApp. Lo que pagás es el plan, fijo por mes, y hay uno gratis hasta 50 productos.",
    cta: "Planes en ecommy.app/planes.",
    hashtags: HASHTAGS,
    check: "No nombrar comisiones de otras plataformas sin verificarlas (MARKETING.md §4).",
    slides: [
      { template: "gancho", title: "Vendiste $ 100.000.", accent: "¿Cuánto te queda?" },
      { template: "dato", kicker: "Con Ecommy", value: "$ 100.000", body: "No cobramos comisión por venta." },
      {
        template: "gancho",
        kicker: "¿Por qué?",
        title: "No hay pasarela.",
        body: "Tu cliente te transfiere a tu cuenta o lo acuerdan por WhatsApp.",
      },
      {
        template: "gancho",
        title: "Lo que pagás es el plan:",
        accent: "fijo por mes.",
        body: "Hay uno gratis hasta 50 productos.",
      },
      {
        template: "gancho",
        tone: "tinta",
        title: "¿Necesitás cobrar con tarjeta en cuotas dentro de la tienda?",
        accent: "Hoy no lo tenemos. Te lo decimos antes.",
        body: "Planes en ecommy.app/planes.",
      },
    ],
  },
  {
    id: "P04",
    kind: "reel",
    name: "Dibujo mi zona de reparto en el mapa",
    formats: BOTH,
    channels: IG_TT,
    days: [5],
    hook: "Reparto en moto en mi barrio. Así le cobro el envío a cada cliente.",
    caption:
      "Zonas dibujadas en el mapa, por provincia o por código postal, cada una con su costo y su plazo. Y envío gratis desde el monto que elijas.",
    cta: "Probalo con tu barrio: link en la bio.",
    hashtags: HASHTAGS,
    check: "Mostrar la dirección de prueba, no la de un cliente.",
    slides: [
      { template: "gancho", title: "Reparto en moto en mi barrio.", accent: "Así le cobro el envío a cada cliente." },
      {
        template: "captura",
        title: "Dibujás la zona en el mapa.",
        body: "Cada zona con su costo y su plazo.",
        placeholder: "Pegá acá la captura de tus zonas en Envíos",
      },
    ],
  },
  {
    id: "P05",
    kind: "reel",
    name: "Cambio masivo de precios con Deshacer",
    formats: BOTH,
    channels: IG_TT,
    days: [4, 25],
    hook: "Llegó la lista con aumento. [cantidad] productos. [segundos] segundos.",
    caption:
      "Porcentaje, monto fijo o margen sobre el costo. Por categoría, marca, etiqueta o producto. Con redondeo (por ejemplo, terminado en 990) y vista previa. Y si te equivocaste, Deshacer.",
    cta: "Está en el plan Pro, y los 14 días de prueba lo incluyen.",
    hashtags: [...HASHTAGS, "#ferreteria"],
    check: "La cantidad de productos del gancho es la de la categoría grabada, y los segundos, los de la grabación.",
    fields: [
      { key: "cantidad", token: "[cantidad]", label: "Productos de la categoría grabada", example: "300" },
      { key: "segundos", token: "[segundos]", label: "Segundos que tarda en la grabación", example: "20" },
    ],
    slides: [
      { template: "gancho", title: "Llegó la lista con aumento.", accent: "[cantidad] productos. [segundos] segundos." },
      {
        template: "antes-despues",
        title: "+8 % a una categoría, terminado en 990.",
        before: { label: "Precio viejo", items: P05_BEFORE.map((p) => formatMoney(p)) },
        after: { label: "Precio nuevo", items: P05_AFTER.map((p) => formatMoney(p)) },
        note: "Ejemplo con redondeo al 990 más cercano. Si te equivocaste, Deshacer.",
      },
    ],
  },
  {
    id: "P06",
    kind: "reel",
    name: "Subo la lista del proveedor por SKU",
    formats: BOTH,
    channels: IG_TT,
    days: [8],
    hook: "Mi proveedor me manda la lista en Excel todas las semanas.",
    caption:
      "Columnas en castellano como código, nombre, precio y stock se reconocen solas. Antes de aplicar ves qué cambia; los precios que entran por importación también se pueden deshacer.",
    cta: "Desde el plan Starter. Probalo 14 días con tu lista.",
    hashtags: [...HASHTAGS, "#ferreteria"],
    check: "Usar una lista de ejemplo propia, no la de un proveedor real sin permiso.",
    slides: [
      { template: "gancho", title: "Mi proveedor me manda la lista en Excel", accent: "todas las semanas." },
      {
        template: "lista",
        kicker: "Actualizar por SKU",
        title: "Subís el CSV y listo.",
        items: [
          "Código, nombre, precio y stock se reconocen solos",
          "Antes de aplicar ves qué cambia",
          "Los precios importados también se pueden deshacer",
        ],
      },
    ],
  },
  {
    id: "P07",
    kind: "reel",
    name: "Traigo mi catálogo desde mi web actual",
    formats: BOTH,
    channels: IG_TT,
    days: [9],
    hook: "Tengo tienda en otro lado. ¿Tengo que cargar todo de nuevo?",
    caption:
      "Funciona con WooCommerce, Shopify y sitios que publican datos estructurados. Antes de importar, “Detectar” te muestra qué se puede traer. Importá sólo catálogos que tengas permiso de usar.",
    cta: "Probalo con tu web: 14 días de Pro incluidos.",
    hashtags: HASHTAGS,
    check: "Grabado con una web propia o autorizada. No prometer “cualquier tienda”.",
    slides: [
      { template: "gancho", title: "Tengo tienda en otro lado.", accent: "¿Tengo que cargar todo de nuevo?" },
      {
        template: "lista",
        kicker: "Importar con “Detectar”",
        title: "Traés el catálogo que ya tenés.",
        items: [
          "WooCommerce, Shopify y sitios con datos estructurados",
          "Antes de importar ves qué se puede traer",
          "Sólo catálogos que tengas permiso de usar",
        ],
      },
    ],
  },
  {
    id: "P08",
    kind: "carrusel",
    name: "Diez estilos, uno por rubro",
    formats: ["feed"],
    channels: ["instagram"],
    days: [6],
    hook: "10 estilos de tienda. ¿Cuál es el tuyo?",
    caption: "Free incluye Nórdico y Mercado; desde Starter, los diez. En la prueba de 14 días podés probarlos todos.",
    cta: "Elegís el rubro al crear la tienda y arranca con su estilo.",
    hashtags: HASHTAGS,
    check: "Una captura real por estilo: de la demo o de una tienda propia, nunca de un cliente sin permiso escrito.",
    slides: [{ template: "gancho", title: "10 estilos de tienda.", accent: "¿Cuál es el tuyo?" }, ...P08_SLIDES],
  },
  {
    id: "P09",
    kind: "carrusel",
    name: "La ley te pide 4 cosas en tu tienda",
    formats: BOTH,
    channels: IG_TT,
    days: [10],
    hook: "Si vendés online en Argentina, tu tienda tiene que mostrar esto.",
    caption:
      "Botón de arrepentimiento, link a Defensa del Consumidor, QR de Data Fiscal y “Precio sin impuestos nacionales” junto al precio. En Ecommy vienen en todos los planes, también en Free. Esto es información general, no asesoramiento legal. Normas: Res. SCI 424/2020 y Res. SIC 4/2025.",
    cta: "Guardá el post y consultalo con tu contador.",
    hashtags: HASHTAGS,
    check: "Revisado por el abogado o el contador (checklist §7.8) antes de publicar. Sumá los links oficiales al texto.",
    slides: [
      { template: "gancho", title: "Si vendés online en Argentina,", accent: "tu tienda tiene que mostrar esto." },
      {
        template: "lista",
        kicker: "Lo que te pide la ley",
        title: "Cuatro cosas, a la vista.",
        items: [
          "Botón de arrepentimiento, con formulario sin registro",
          "Link a Defensa del Consumidor",
          "QR de Data Fiscal",
          "“Precio sin impuestos nacionales” junto al precio",
        ],
      },
      {
        template: "gancho",
        tone: "tinta",
        title: "En Ecommy vienen en todos los planes,",
        accent: "también en Free.",
        body: "Guardá el post y consultalo con tu contador. Información general, no asesoramiento legal.",
      },
    ],
  },
  {
    id: "P10",
    kind: "reel",
    name: "El precio con transferencia, desde la primera foto",
    formats: BOTH,
    channels: IG_TT,
    days: [11],
    hook: "Si das descuento por transferencia, que se vea antes del checkout.",
    caption:
      "El comprador ve el precio con descuento desde el listado, copia alias y monto con un toque y te manda el comprobante por WhatsApp con el número de pedido.",
    cta: "Mirá la demo.",
    hashtags: HASHTAGS,
    slides: [
      { template: "gancho", title: "Si das descuento por transferencia,", accent: "que se vea antes del checkout." },
      {
        template: "captura",
        title: "El precio con transferencia, desde el listado.",
        placeholder: "Pegá acá la captura de la tienda con el precio con transferencia",
      },
    ],
  },
  {
    id: "P11",
    kind: "carrusel",
    name: "Qué pasa cuando no te pagan",
    formats: ["feed"],
    channels: ["instagram"],
    days: [13],
    hook: "Te hicieron un pedido por transferencia y nunca pagaron. ¿Y el stock?",
    caption:
      "En Ecommy elegís cuántas horas reservás el stock. Si no llega el pago en ese plazo, el pedido se cancela solo y el stock vuelve a estar disponible.",
    cta: "Probalo 14 días.",
    hashtags: HASHTAGS,
    slides: [
      { template: "gancho", title: "Te hicieron un pedido por transferencia y nunca pagaron.", accent: "¿Y el stock?" },
      { template: "gancho", title: "En Ecommy elegís cuántas horas", accent: "reservás el stock." },
      { template: "gancho", title: "Si no llega el pago en ese plazo,", accent: "el pedido se cancela solo." },
      { template: "gancho", title: "El stock vuelve a estar disponible." },
      { template: "gancho", tone: "tinta", title: "Vos no tenés que acordarte.", body: "Probalo 14 días." },
    ],
  },
  {
    id: "P12",
    kind: "reel",
    name: "El pedido del local también cuenta",
    formats: BOTH,
    channels: IG_TT,
    days: [15],
    hook: "No todas las ventas entran por la web.",
    caption: "Pedidos manuales que descuentan stock y remitos para imprimir, en todos los planes.",
    cta: "Link en la bio.",
    hashtags: HASHTAGS,
    slides: [
      { template: "gancho", title: "No todas las ventas", accent: "entran por la web." },
      {
        template: "lista",
        kicker: "Pedidos manuales",
        title: "El pedido del local también cuenta.",
        items: ["Cargás la venta del mostrador o de WhatsApp", "Descuenta stock", "Imprimís el remito para armar el paquete"],
      },
    ],
  },
  {
    id: "P13",
    kind: "reel",
    name: "Invito a mi socia al panel",
    formats: BOTH,
    channels: IG_TT,
    days: [16],
    hook: "Mi socia arma los pedidos. Yo cargo productos. Cada una con su usuario.",
    caption: "Invitación por link, roles por tienda y la podés quitar del equipo cuando quieras.",
    cta: "Desde Starter, hasta 3 personas; en Pro, hasta 10.",
    hashtags: HASHTAGS,
    slides: [
      { template: "gancho", title: "Mi socia arma los pedidos. Yo cargo productos.", accent: "Cada una con su usuario." },
      {
        template: "lista",
        kicker: "Equipo por tienda",
        title: "Invitás con un link.",
        items: ["Invitación por link", "Roles por tienda", "La quitás del equipo cuando quieras"],
      },
    ],
  },
  {
    id: "P14",
    kind: "reel",
    name: "Armo la portada con bloques",
    formats: BOTH,
    channels: IG_TT,
    days: [17],
    hook: "Mi portada, sin diseñador, en [tiempo real].",
    caption: "Bloques de portada, carruseles, banners y texto, con vista previa antes de publicar.",
    cta: "Link en la bio.",
    hashtags: HASHTAGS,
    check: "El tiempo del gancho es el de la grabación (“5 minutos” sólo si dura eso).",
    fields: [{ key: "tiempo", token: "[tiempo real]", label: "Tiempo real de la grabación", example: "5 minutos" }],
    slides: [
      { template: "gancho", title: "Mi portada, sin diseñador,", accent: "en [tiempo real]." },
      {
        template: "captura",
        title: "Bloques, con vista previa antes de publicar.",
        placeholder: "Pegá acá la captura del armador de páginas",
      },
    ],
  },
  {
    id: "P15",
    kind: "reel",
    name: "¿Te conviene cambiarte de plataforma?",
    formats: BOTH,
    channels: IG_TT,
    days: [18],
    hook: "Estás en otra plataforma. Te digo cuándo NO cambiarte a Ecommy.",
    caption:
      "Probalo 14 días al lado de tu tienda actual. Traé tu catálogo con el importador.",
    cta: "Link en la bio.",
    hashtags: HASHTAGS,
    check: "No nombrar marcas ajenas con datos sin verificar.",
    slides: [
      { template: "gancho", title: "Estás en otra plataforma.", accent: "Te digo cuándo NO cambiarte a Ecommy." },
      {
        template: "antes-despues",
        title: "¿Te conviene cambiarte?",
        before: {
          label: "No te cambies si",
          items: [
            "Vendés mucho con tarjeta en cuotas dentro de la tienda",
            "Necesitás etiquetas de correo automáticas",
            "Sincronizás con Mercado Libre",
          ],
        },
        after: {
          label: "Sí probalo si",
          items: [
            "Tus ventas terminan en transferencia o WhatsApp",
            "Actualizás precios seguido",
            "No querés pagar comisión por venta",
          ],
        },
      },
    ],
  },
];
