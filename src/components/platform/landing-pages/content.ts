/*
 * Copy de las páginas de captación (docs/MARKETING.md §6.2 y §6.3):
 * /alternativa-a-tiendanube, /funciones/pedidos-por-whatsapp y
 * /funciones/cobrar-por-transferencia. Vive acá, en datos, para que los
 * tests revisen largos de metadata, palabras prohibidas (BRAND §3.1) y que
 * cada dato de un tercero tenga fuente y fecha.
 *
 * Reglas:
 * - Lo que se dice de Ecommy sale del código o de MARKETING §0. Los "desde
 *   qué plan" se calculan con los planes de la base (`plan-notes`).
 * - Lo que se dice de Tiendanube o de WhatsApp Business se verificó en su
 *   sitio oficial el día de `VERIFIED_AT` y cita su fuente. Si cambia, se
 *   vuelve a verificar y se actualiza la fecha; si no se puede verificar,
 *   se borra (no se deja aproximado).
 * - Ningún número de Ecommy en pesos: los precios van por `/planes`.
 */

import { PLAN_DEFAULTS, type FeatureKey, type PlanInfo } from "@/lib/plans";

import { availability, availabilityPhrase, minPlanName, type PlanLike } from "../plan-notes";

/** Día en que se verificaron los datos de terceros (ISO, sin hora). */
export const VERIFIED_AT = "2026-10-15";

export type LandingPlan = PlanLike & Partial<Pick<PlanInfo, "code" | "limits">>;

export interface PageMeta {
  path: string;
  /** Título completo (va con `absolute`: el template del layout no se suma). ≤ 60. */
  title: string;
  /** Meta descripción. ≤ 155. */
  description: string;
  /** Imagen para compartir. */
  og: { eyebrow: string; title: string; highlight?: string; line: string };
}

export interface PageFaqItem {
  id: string;
  q: string;
  a: string;
}

/* ------------------------------------------------------------------ */
/* Fuentes de terceros                                                  */
/* ------------------------------------------------------------------ */

export type SourceId =
  | "tn-planes"
  | "tn-costos"
  | "tn-calculo"
  | "tn-inicial"
  | "tn-pagonube"
  | "tn-transferencia"
  | "tn-app-whatsapp"
  | "tn-chatnube"
  | "tn-variantes"
  | "tn-arrepentimiento"
  | "tn-mercadolibre"
  | "wa-funciones";

export interface Source {
  id: SourceId;
  label: string;
  url: string;
}

/** Páginas oficiales consultadas el día de `VERIFIED_AT`. */
export const SOURCES: Record<SourceId, Source> = {
  "tn-planes": { id: "tn-planes", label: "Tiendanube · Planes y precios", url: "https://www.tiendanube.com/planes-y-precios" },
  "tn-costos": {
    id: "tn-costos",
    label: "Tiendanube · ¿Qué son los costos por transacción?",
    url: "https://ayuda.tiendanube.com/es_AR/123484-costos-por-transaccion/que-son-los-costos-por-transaccion-de-tiendanube",
  },
  "tn-calculo": {
    id: "tn-calculo",
    label: "Tiendanube · ¿Cómo se calculan los costos por transacción?",
    url: "https://ayuda.tiendanube.com/es_AR/123484-costos-por-transaccion/como-se-calculan-los-costos-por-transaccion",
  },
  "tn-inicial": {
    id: "tn-inicial",
    label: "Tiendanube · Costos del plan Inicial",
    url: "https://ayuda.tiendanube.com/es_AR/123482-planes/cuales-son-los-costos-del-plan-tienda-inicial",
  },
  "tn-pagonube": {
    id: "tn-pagonube",
    label: "Tiendanube · Comisiones de Pago Nube",
    url: "https://ayuda.tiendanube.com/es_AR/pago-nube/cuales-son-las-comisiones-de-pago-nube",
  },
  "tn-transferencia": {
    id: "tn-transferencia",
    label: "Tiendanube · Cómo configurar el pago por transferencia",
    url: "https://ayuda.tiendanube.com/es_AR/122925-medio-de-pago-personalizado/como-configurar-una-opcion-de-pago-por-transferencia-en-mi-tienda",
  },
  "tn-app-whatsapp": {
    id: "tn-app-whatsapp",
    label: "Tiendanube · App «Continuar por WhatsApp»",
    url: "https://www.tiendanube.com/tienda-aplicaciones-nube/continuar-pelo-whatsapp",
  },
  "tn-chatnube": { id: "tn-chatnube", label: "Tiendanube · ¿Qué es Chat Nube?", url: "https://ayuda.tiendanube.com/es_AR/activar-chat-nube/que-es-chat-nube" },
  "tn-variantes": {
    id: "tn-variantes",
    label: "Tiendanube · Variantes del producto",
    url: "https://ayuda.tiendanube.com/es_AR/160437-variantes-del-producto/que-son-las-variantes-y-como-configurarlas-en-mis-productos",
  },
  "tn-arrepentimiento": {
    id: "tn-arrepentimiento",
    label: "Tiendanube · Botón de arrepentimiento",
    url: "https://ayuda.tiendanube.com/es_AR/123288-mis-ventas/que-es-el-boton-de-arrepentimiento-de-compra-de-mi-tiendanube",
  },
  "tn-mercadolibre": {
    id: "tn-mercadolibre",
    label: "Tiendanube · Vincular Mercado Libre",
    url: "https://ayuda.tiendanube.com/es_AR/canales-de-ventas/como-vincular-mi-cuenta-de-mercado-libre-con-mi-tienda",
  },
  "wa-funciones": {
    id: "wa-funciones",
    label: "WhatsApp Business · Funciones de la app",
    url: "https://whatsappbusiness.com/es-la/products/business-app-features/",
  },
};

/* ------------------------------------------------------------------ */
/* Ayudas                                                               */
/* ------------------------------------------------------------------ */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Todos los planes" · "Desde Starter" (etiqueta suelta). */
export function planLabel(plans: readonly LandingPlan[], key: FeatureKey): string {
  return capitalize(availability(plans, key));
}

/** Tope de productos de Free según la base (o el default del código). `null` = sin tope. */
export function freeProducts(plans: readonly LandingPlan[]): number | null {
  const free = plans.find((p) => p.code === "free");
  return free?.limits ? free.limits.products : PLAN_DEFAULTS.free.limits.products;
}

/* ------------------------------------------------------------------ */
/* /alternativa-a-tiendanube                                            */
/* ------------------------------------------------------------------ */

export const TIENDANUBE_META: PageMeta = {
  path: "/alternativa-a-tiendanube",
  title: "Alternativa a Tiendanube sin comisión por venta · Ecommy",
  description:
    "Si vendés por Instagram y WhatsApp y cobrás por transferencia, Ecommy no te cobra comisión por venta. Comparación con Tiendanube, con fuentes y fecha.",
  og: {
    eyebrow: "Ecommy o Tiendanube",
    title: "Si vendés por chat, pagá por eso y nada más.",
    highlight: "nada más.",
    line: "Comparación honesta, con fuentes: cuándo te conviene cada una.",
  },
};

export type Verdict = "ecommy" | "paridad" | "tiendanube";

export const VERDICT_LABEL: Record<Verdict, string> = {
  ecommy: "Diferencia",
  paridad: "Paridad",
  tiendanube: "Tiendanube tiene más",
};

export interface CompareRow {
  topic: string;
  ecommy: string;
  tiendanube: string;
  verdict: Verdict;
  sources: SourceId[];
}

export interface CompareGroup {
  title: string;
  rows: CompareRow[];
}

/**
 * La comparación punto por punto. Sólo filas que se pueden sostener: la
 * columna de Tiendanube con su fuente del día; la de Ecommy, con el código.
 */
export function compareGroups(plans: readonly LandingPlan[]): CompareGroup[] {
  const replies = availabilityPhrase(plans, "orders.replies");
  const webPlan = minPlanName(plans, "catalog.import_web") ?? "Pro";
  const free = freeProducts(plans);
  return [
    {
      title: "Cómo cobrás",
      rows: [
        {
          topic: "Comisión por venta",
          ecommy: "Ninguna, en ningún plan. Pagás el plan fijo por mes y lo que vendés es tuyo.",
          tiendanube:
            "Con medios de pago que no son Pago Nube, un costo por transacción del 2 % en Esencial, 1 % en Impulso y 0,7 % en Escala. Con Pago Nube ese costo es 0 %, pero Pago Nube cobra su comisión: la transferencia, 1,50 % + IVA en Inicial y Esencial.",
          verdict: "ecommy",
          sources: ["tn-costos", "tn-pagonube"],
        },
        {
          topic: "Ventas que cerrás por chat y cargás a mano",
          ecommy: "Cargás el pedido manual y no paga nada por venta.",
          tiendanube: "Las órdenes cargadas a mano también entran en el cálculo del costo por transacción. En Inicial, las manuales con pago confirmado generan costo.",
          verdict: "ecommy",
          sources: ["tn-calculo", "tn-inicial"],
        },
        {
          topic: "A dónde va la plata",
          ecommy: "La transferencia, a tu alias o CBU. La tarjeta, a tu propia cuenta de Mercado Pago. Nunca pasa por Ecommy.",
          tiendanube:
            "Con Pago Nube, a tu cuenta de Pago Nube, y con tarjeta se libera según el plazo que elijas (1, 7, 14 o 30 días, con distinta comisión). Con pago personalizado (desde Esencial), a tu cuenta.",
          verdict: "ecommy",
          sources: ["tn-pagonube", "tn-transferencia"],
        },
        {
          topic: "Confirmar la transferencia",
          ecommy: "La confirmás vos al ver el comprobante, con un toque desde Hoy. Mientras tanto el stock queda reservado las horas que elijas.",
          tiendanube: "Con Pago Nube se confirma sola si te pagan el monto exacto. Con pago personalizado, la confirmás a mano.",
          verdict: "tiendanube",
          sources: ["tn-transferencia"],
        },
        {
          topic: "Descuento por transferencia",
          ecommy: "Sí, en todos los planes, y el precio con descuento se ve en cada producto.",
          tiendanube: "Sí, configurándolo en Pago Nube.",
          verdict: "paridad",
          sources: ["tn-transferencia"],
        },
        {
          topic: "Tarjeta y cuotas",
          ecommy: "Con tu cuenta de Mercado Pago, en todos los planes. Cuotas sin interés en 3, 6, 9 o 12 si las activás.",
          tiendanube: "Con Pago Nube (tarjeta, débito y MODO) y otros medios de pago.",
          verdict: "paridad",
          sources: ["tn-pagonube"],
        },
      ],
    },
    {
      title: "Cómo vendés por chat",
      rows: [
        {
          topic: "Pedido armado a tu WhatsApp",
          ecommy:
            "De fábrica, en todos los planes. El pedido queda registrado con número y te llega con talle, color, total y entrega.",
          tiendanube: "Con apps de su tienda de aplicaciones, como «Continuar por WhatsApp», que arma el mensaje con el carrito y tiene costo mensual.",
          verdict: "ecommy",
          sources: ["tn-app-whatsapp"],
        },
        {
          topic: "Consultas por WhatsApp",
          ecommy: `Responder: buscás el producto y copiás una respuesta con precio, stock y link. La mandás vos. ${capitalize(replies)}.`,
          tiendanube: "Chat Nube: un asistente con IA que responde solo por WhatsApp y se cobra por conversación.",
          verdict: "ecommy",
          sources: ["tn-chatnube"],
        },
      ],
    },
    {
      title: "Catálogo y tienda",
      rows: [
        {
          topic: "Variantes con stock",
          ecommy: "Talle y color, cada combinación con su stock. Lo agotado se tacha solo en la tienda.",
          tiendanube: "Sí, por combinación (por ejemplo, color y talle), cada una con su stock y su precio.",
          verdict: "paridad",
          sources: ["tn-variantes"],
        },
        {
          topic: "Botón de arrepentimiento",
          ecommy: "Sí, en todos los planes, con su bandeja en el panel.",
          tiendanube: "Sí, en todas sus tiendas que operan en Argentina.",
          verdict: "paridad",
          sources: ["tn-arrepentimiento"],
        },
        {
          topic: "Plan gratis",
          ecommy: free === null ? "Free, sin vencimiento." : `Free, hasta ${free} productos, sin vencimiento.`,
          tiendanube: "Inicial, sin límite de productos. Ahí se cobra con Pago Nube.",
          verdict: "tiendanube",
          sources: ["tn-planes", "tn-transferencia"],
        },
        {
          topic: "Mudanza desde otra tienda",
          ecommy: `Importás desde tu web actual (${webPlan}, incluido en la prueba) o te cargamos el catálogo nosotros.`,
          tiendanube: "Migración asistida, según su comparación de planes.",
          verdict: "paridad",
          sources: ["tn-planes"],
        },
      ],
    },
    {
      title: "Lo que Tiendanube tiene y Ecommy no",
      rows: [
        {
          topic: "Correos y etiquetas",
          ecommy: "No hay integración con correos. Cobrás el envío por zona y despachás vos.",
          tiendanube: "Envío Nube y, desde Esencial, más de 30 medios de envío.",
          verdict: "tiendanube",
          sources: ["tn-planes"],
        },
        {
          topic: "Mercado Libre",
          ecommy: "No se conecta con Mercado Libre.",
          tiendanube: "Con apps de su tienda de aplicaciones que sincronizan stock y precio.",
          verdict: "tiendanube",
          sources: ["tn-mercadolibre"],
        },
        {
          topic: "Apps de terceros",
          ecommy: "No hay tienda de aplicaciones ni API pública.",
          tiendanube: "Tienda de aplicaciones: canales de venta, comunicación, pagos y envíos.",
          verdict: "tiendanube",
          sources: ["tn-mercadolibre", "tn-app-whatsapp", "tn-planes"],
        },
      ],
    },
  ];
}

/** "Cuándo te conviene cada una": la sección que más confianza compra. */
export function whenToChoose(plans: readonly LandingPlan[]): { tiendanube: { title: string; text: string }[]; ecommy: { title: string; text: string }[] } {
  const free = freeProducts(plans);
  return {
    tiendanube: [
      {
        title: "Despachás muchos paquetes por correo",
        text: "Tiendanube trae Envío Nube y más de 30 medios de envío. Ecommy no tiene etiquetas ni cotización de correos: cobrás por zona y despachás vos.",
      },
      {
        title: "Vendés fuerte en Mercado Libre",
        text: "En Tiendanube sincronizás stock y precio con apps de su tienda de aplicaciones. Ecommy no se conecta con Mercado Libre.",
      },
      {
        title: "Dependés de apps",
        text: "Reseñas, facturación automática, ERPs: Tiendanube tiene tienda de aplicaciones. Ecommy no tiene apps ni API pública.",
      },
      {
        title: "Querés que la transferencia se acredite sola",
        text: "Con Pago Nube se confirma sola si te pagan el monto exacto. En Ecommy la confirmás vos al ver el comprobante.",
      },
      {
        title: "Tenés un catálogo grande y no querés pagar plan",
        text:
          free === null
            ? "El plan Inicial de Tiendanube no tiene límite de productos y cobra con Pago Nube."
            : `El plan Inicial de Tiendanube no tiene límite de productos y cobra con Pago Nube. El Free de Ecommy llega a ${free}.`,
      },
    ],
    ecommy: [
      {
        title: "Vendés por Instagram y WhatsApp",
        text: "La clienta arma el pedido en tu tienda y te llega a WhatsApp con talle, color, total y entrega, ya registrado con número. En todos los planes.",
      },
      {
        title: "Cobrás por transferencia",
        text: "Pagás el plan y nada más: ni comisión por venta ni costo por transacción. La plata va a tu alias; con tarjeta, a tu Mercado Pago.",
      },
      {
        title: "Tu catálogo es de talle y color",
        text: "Cada combinación con su stock, que baja con cada pedido y vuelve solo si no te pagan en el plazo que elegiste.",
      },
      {
        title: "Te preguntan lo mismo todo el día",
        text: `Responder te arma la respuesta con precio, stock y link para copiar en el chat. La mandás vos (${availabilityPhrase(plans, "orders.replies")}).`,
      },
      {
        title: "Querés saber qué hacer hoy",
        text: "Al abrir el panel, Hoy te muestra los pagos por confirmar y los pedidos por preparar, y los resolvés ahí mismo.",
      },
    ],
  };
}

export function tiendanubeFaq(plans: readonly LandingPlan[]): PageFaqItem[] {
  const webPlan = minPlanName(plans, "catalog.import_web") ?? "Pro";
  const domainPlan = minPlanName(plans, "domain.custom") ?? "Pro";
  return [
    {
      id: "comision",
      q: "¿Ecommy cobra comisión por venta?",
      a: "No. Pagás el plan por mes y nada más, en todos los planes. Por transferencia, la plata va a tu alias; con tarjeta, a tu cuenta de Mercado Pago, donde sólo pagás la comisión de Mercado Pago.",
    },
    {
      id: "al-lado",
      q: "¿Puedo probar Ecommy sin cerrar mi tienda actual?",
      a: "Sí. Probás 14 días de Pro sin tarjeta, con tu catálogo, mientras tu tienda actual sigue abierta. Si te sirve, cambiás el dominio cuando quieras; si no, pasás a Free y no se borra nada.",
    },
    {
      id: "importar",
      q: "¿Se puede traer el catálogo desde Tiendanube?",
      a: `El importador desde otra web (plan ${webPlan}, incluido en la prueba) está probado con WooCommerce, Shopify y sitios con datos schema.org; con tiendas de Tiendanube todavía no lo probamos en casos reales. Lo intentamos y lo que no se pueda traer lo cargamos nosotros.`,
    },
    {
      id: "google",
      q: "¿Pierdo lo que gané en Google si me mudo?",
      a: `No tiene por qué. Con tu dominio apuntando a Ecommy (desde ${domainPlan}) cargás redirecciones 301 de las direcciones viejas a las nuevas, una por una o en CSV, y los links que Google ya conoce siguen llevando a tus productos.`,
    },
    {
      id: "tarjeta",
      q: "¿Mis clientas pueden pagar con tarjeta y en cuotas?",
      a: "Sí, si conectás tu cuenta de Mercado Pago: crédito, débito o dinero en cuenta, con cuotas sin interés si las activás. El pedido se marca como pagado solo.",
    },
    {
      id: "no-hace",
      q: "¿Qué hace Tiendanube que Ecommy no?",
      a: "Integración con correos y etiquetas, sincronización con Mercado Libre, tienda de aplicaciones y acreditación automática de transferencias con Pago Nube. Ecommy tampoco hace factura electrónica: seguís facturando con tu sistema.",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* /funciones/pedidos-por-whatsapp                                      */
/* ------------------------------------------------------------------ */

export const WHATSAPP_META: PageMeta = {
  path: "/funciones/pedidos-por-whatsapp",
  title: "Tienda online con pedidos por WhatsApp · Ecommy",
  description:
    "Tu clienta elige talle y color, arma el pedido y te llega armado a WhatsApp, con número y registrado en tu panel. Sin app y sin comisión por venta.",
  og: {
    eyebrow: "Pedidos por WhatsApp",
    title: "El pedido te llega a WhatsApp armado.",
    highlight: "armado.",
    line: "Con talle, color, total y entrega, y registrado en tu panel antes de abrir el chat.",
  },
};

export interface FlowStep {
  title: string;
  text: string;
}

export const WHATSAPP_FLOW: FlowStep[] = [
  { title: "Elige talle y color", text: "En la ficha ve qué talles quedan de cada color. Lo agotado aparece tachado." },
  { title: "Arma el pedido", text: "Suma al carrito lo que quiere, con el precio con transferencia a la vista desde la card." },
  { title: "Elige entrega y pago", text: "El envío se calcula por zona o elige retiro en tu local. Paga por transferencia, con tu Mercado Pago o lo acuerda con vos." },
  { title: "Queda registrado", text: "Al confirmar, el pedido tiene número y reserva el stock. Recién ahí se abre WhatsApp." },
  { title: "Te llega armado", text: "Cada producto con su talle, el total, la entrega, el nombre y el link al pedido. El texto es tu plantilla y lo podés cambiar." },
  { title: "Aparece en Hoy", text: "Al abrir el panel lo ves entre los pagos por confirmar o los pedidos por preparar, y avisás por WhatsApp con un toque." },
];

/** WhatsApp Business: lo que dice su página de funciones (verificado) contra lo que hace la tienda. */
export const CATALOG_COMPARE: { topic: string; catalog: string; ecommy: string }[] = [
  {
    topic: "Mostrar productos",
    catalog: "Catálogo dentro de WhatsApp, con colecciones.",
    ecommy: "Tu tienda con tu marca y su dirección, para la bio, las historias y Google.",
  },
  {
    topic: "Armar el pedido",
    catalog: "La clienta elige artículos y te los manda en un solo mensaje.",
    ecommy: "La clienta arma el carrito y te llega el pedido armado, con total y entrega.",
  },
  {
    topic: "Talle y color con stock",
    catalog: "Su página de funciones no lo menciona.",
    ecommy: "Cada combinación con su stock, que baja con cada pedido.",
  },
  {
    topic: "Costo de envío",
    catalog: "Su página de funciones no lo menciona.",
    ecommy: "Se calcula solo por zona, o retiro en tu local.",
  },
  {
    topic: "Registro del pedido",
    catalog: "El pedido es un mensaje en el chat.",
    ecommy: "Número, estado y pago en tu panel, aunque el chat se pierda.",
  },
];

export const WHATSAPP_NOT: { title: string; text: string }[] = [
  { title: "No es un bot", text: "No responde solo. Responder te arma el texto con precio, stock y link, y lo mandás vos desde tu WhatsApp." },
  { title: "No necesita la API de WhatsApp", text: "El pedido se abre en tu WhatsApp de siempre, con tu número, sea la app común o WhatsApp Business." },
  { title: "No escribe por WhatsApp en tu nombre", text: "Los avisos de pago confirmado, envío o retiro por WhatsApp los mandás vos desde el panel, con el mensaje ya escrito." },
];

export function whatsappFaq(plans: readonly LandingPlan[]): PageFaqItem[] {
  return [
    {
      id: "plan",
      q: "¿En qué plan está el pedido por WhatsApp?",
      a: `En todos, incluido Free. Responder, las respuestas listas para las consultas, está ${availabilityPhrase(plans, "orders.replies")}.`,
    },
    {
      id: "api",
      q: "¿Necesito WhatsApp Business o la API de WhatsApp?",
      a: "No. El pedido se abre en el WhatsApp que ya usás, con tu número. Sirve la app común o WhatsApp Business, y no hay que contratar nada aparte.",
    },
    {
      id: "no-manda",
      q: "¿Qué pasa si la clienta confirma y no manda el mensaje?",
      a: "El pedido ya quedó registrado con número en tu panel antes de que se abra WhatsApp, con sus datos y el stock reservado. Lo ves en Hoy igual y le podés escribir vos.",
    },
    {
      id: "texto",
      q: "¿Puedo cambiar el texto del mensaje?",
      a: "Sí. En Configuración › Pagos y checkout editás la plantilla con el número, los productos, el total, la entrega y el nombre. El link al pedido va siempre.",
    },
    {
      id: "bot",
      q: "¿Ecommy les contesta solo a mis clientas?",
      a: "No. Ecommy no es un bot: Responder te arma la respuesta con precio, stock y link, y la mandás vos desde tu WhatsApp.",
    },
    {
      id: "instagram",
      q: "¿Sirve si vendo por Instagram?",
      a: "Sí. Ponés el link de tu tienda en la bio o en las historias; la clienta arma el pedido ahí y te llega a WhatsApp, que es donde ya cerrás las ventas.",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* /funciones/cobrar-por-transferencia                                  */
/* ------------------------------------------------------------------ */

export const TRANSFER_META: PageMeta = {
  path: "/funciones/cobrar-por-transferencia",
  title: "Tienda online con pago por transferencia · Ecommy",
  description:
    "Descuento por transferencia visible en cada producto, alias para copiar, stock reservado mientras te pagan y comisión de Ecommy $ 0. Probalo 14 días.",
  og: {
    eyebrow: "Cobrar por transferencia",
    title: "Cobrás por transferencia. Ecommy se queda con $ 0.",
    highlight: "$ 0.",
    line: "Descuento visible en cada producto, alias para copiar y stock reservado mientras te pagan.",
  },
};

export const TRANSFER_FLOW: FlowStep[] = [
  { title: "Cargás tu alias y el descuento", text: "Alias o CBU, titular y el porcentaje. El CBU y el alias se validan antes de guardar." },
  { title: "El descuento se ve antes de comprar", text: "Cada card y cada ficha muestran el precio con transferencia al lado del precio de lista." },
  { title: "Tu clienta copia el alias", text: "Al confirmar ve su pedido con el total, tus datos para copiar y hasta cuándo le reservás el stock." },
  { title: "Te manda el comprobante", text: "Con un toque desde su pedido, por WhatsApp, con el número y el total ya escritos." },
  { title: "Confirmás vos", text: "Ves el comprobante, revisás tu cuenta y marcás el pago desde Hoy. Si no paga en el plazo, el pedido vence solo y el stock vuelve." },
];

export function transferFaq(): PageFaqItem[] {
  return [
    {
      id: "comision",
      q: "¿Ecommy cobra algo por cada transferencia?",
      a: "No. Pagás el plan por mes y nada más. La transferencia va de la cuenta de tu clienta a la tuya y no pasa por Ecommy.",
    },
    {
      id: "descuento",
      q: "¿El descuento se ve antes del checkout?",
      a: "Sí. Cada card del catálogo y cada ficha muestran el precio con transferencia, y el checkout lo aplica al elegir ese medio de pago.",
    },
    {
      id: "como-se",
      q: "¿Cómo sé que me pagaron?",
      a: "Como hoy: mirás tu cuenta. Ecommy no ve tu banco. Tu clienta te manda el comprobante por WhatsApp desde su pedido y vos marcás el pago con un toque.",
    },
    {
      id: "no-paga",
      q: "¿Qué pasa si no me pagan?",
      a: "Elegís cuántas horas reservás el stock. Si en ese plazo no registrás el pago, el pedido se cancela solo y el stock vuelve al inventario. Si ponés 0, no vence nunca.",
    },
    {
      id: "tarjeta",
      q: "¿Puedo ofrecer tarjeta además de transferencia?",
      a: "Sí. Conectás tu cuenta de Mercado Pago y tu clienta paga con tarjeta, con cuotas sin interés si las activás. La plata entra a tu Mercado Pago y la comisión de Mercado Pago la cobra Mercado Pago.",
    },
    {
      id: "plan",
      q: "¿En qué plan está?",
      a: "En todos, incluido Free: transferencia con descuento, Mercado Pago y la reserva de stock con vencimiento.",
    },
  ];
}

/** Todas las páginas, para el sitemap, el pie y los tests. */
export const LANDING_PAGES = [TIENDANUBE_META, WHATSAPP_META, TRANSFER_META] as const;
