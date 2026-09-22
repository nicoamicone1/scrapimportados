/**
 * Plantillas legales orientativas para tiendas de Argentina (P0-17).
 * Markdown mínimo (lo renderiza `markdownToHtml` de src/lib/store/markdown.ts).
 * Sin título principal: la página `/politicas/[tipo]` ya muestra el suyo.
 *
 * Variables: {{store.name}} {{store.razon_social}} {{store.cuit}}
 * {{store.email}} {{store.address}}. Se reemplazan al "Insertar plantilla";
 * si un dato falta, queda un marcador visible entre corchetes para completar.
 *
 * NO es asesoramiento legal: el comercio tiene que revisarlas con su asesor.
 */

import type { PolicyKey } from "@/lib/schemas/settings";

export const LEGAL_DISCLAIMER = "Plantilla orientativa, no es asesoramiento legal.";

export interface LegalTemplateVars {
  name?: string | null;
  razon_social?: string | null;
  cuit?: string | null;
  email?: string | null;
  address?: string | null;
}

const PLACEHOLDERS: Record<keyof LegalTemplateVars, string> = {
  name: "[nombre de la tienda]",
  razon_social: "[razón social]",
  cuit: "[CUIT]",
  email: "[email de contacto]",
  address: "[domicilio]",
};

/** Reemplaza `{{store.x}}`; los datos vacíos quedan como `[marcador]`. */
export function fillLegalTemplate(template: string, vars: LegalTemplateVars): string {
  return template.replace(/\{\{\s*store\.(\w+)\s*\}\}/g, (match, key: string) => {
    if (!(key in PLACEHOLDERS)) return match;
    const k = key as keyof LegalTemplateVars;
    const v = vars[k]?.trim();
    return v ? v : PLACEHOLDERS[k];
  });
}

export interface LegalTemplate {
  key: PolicyKey;
  title: string;
  /** Slug sugerido para `/politicas/[tipo]`. */
  slug: string;
  body: string;
}

const SHIPPING = `Esta política explica cómo, cuándo y a qué costo entrega sus pedidos **{{store.name}}** ({{store.razon_social}}, CUIT {{store.cuit}}).

## Zonas y costos

- El costo del envío se calcula en el checkout según la dirección de entrega y se muestra **antes de confirmar la compra**.
- Si tu dirección no está dentro de nuestras zonas, te lo avisamos en el checkout y podés consultarnos por otras alternativas.
- Cuando corresponda envío gratis (por monto mínimo o por promoción), se aplica automáticamente y lo vas a ver reflejado en el total.
- También podés elegir **retiro sin cargo** en nuestros puntos de retiro, cuando estén disponibles.

## Plazos

- Preparamos los pedidos una vez **acreditado el pago**. Si pagás por transferencia, el plazo empieza a correr desde que confirmamos la acreditación.
- El plazo estimado de entrega se informa en el checkout para cada zona y se cuenta en días hábiles.
- Los plazos son estimados y pueden extenderse por causas ajenas a nosotros (feriados, clima, demoras del transporte). Si tu pedido se demora, te avisamos.

## Seguimiento

Con cada pedido recibís un link para ver su estado en todo momento. Cuando lo despachamos, cargamos ahí el número de seguimiento del transporte.

## Recepción

- Revisá el paquete al recibirlo. Si está dañado o abierto, dejá constancia con el transportista y avisanos dentro de las **48 horas**.
- Si nadie puede recibir el pedido, el transporte puede intentar una nueva entrega o dejarlo en su sucursal. Los reenvíos por datos incorrectos o ausencia pueden tener costo adicional.

## Retiro en persona

Si elegís retirar, te avisamos cuando el pedido esté listo. Para retirarlo presentá el número de pedido y el DNI del titular de la compra (o de quien autorices por escrito).

## Contacto

Por cualquier consulta sobre tu envío escribinos a {{store.email}}.
`;

const RETURNS = `En **{{store.name}}** queremos que estés conforme con tu compra. Esta política se rige por la Ley 24.240 de Defensa del Consumidor y sus normas complementarias.

## Derecho de arrepentimiento (10 días)

- Por ser una compra a distancia, tenés derecho a **revocar la aceptación dentro de los 10 (diez) días corridos** desde que recibiste el producto o desde la celebración del contrato, lo último que ocurra, **sin necesidad de dar explicaciones y sin costo** (art. 34 de la Ley 24.240 y art. 1110 del Código Civil y Comercial).
- Podés hacerlo desde el **Botón de arrepentimiento** que está al pie de todas las páginas de la tienda, sin necesidad de registrarte (Resolución 424/2020). Al enviarlo recibís un **código de identificación** del trámite.
- El producto tiene que estar en el mismo estado en que lo recibiste, con sus accesorios y embalaje.
- Los gastos de devolución corren por nuestra cuenta. Te indicamos cómo enviarlo o dónde entregarlo.
- Te reintegramos el total pagado, por el mismo medio de pago, una vez recibido el producto.

## Cambios

- Podés cambiar un producto por talle, color u otro artículo dentro de los **30 días corridos** desde que lo recibiste, siempre que esté sin uso, con etiquetas y en su embalaje original.
- Si el producto nuevo tiene otro precio, se abona o se reintegra la diferencia.
- Los costos de envío de un cambio por gusto o talle corren por cuenta del cliente, salvo que se indique lo contrario.

## Productos con fallas

- Si un producto llega fallado o con defectos, avisanos a {{store.email}} con el número de pedido y fotos del problema.
- Rige la garantía legal de la Ley 24.240 (6 meses para productos nuevos, salvo que el fabricante ofrezca una mayor). Podés optar por la reparación, el cambio por otro igual o la devolución del importe.
- En estos casos los costos de envío están a nuestro cargo.

## Excepciones

Por razones de higiene no se aceptan cambios de ropa interior, trajes de baño ni productos de uso personal abiertos, salvo que presenten fallas.

## Cómo iniciar un cambio o devolución

1. Escribinos a {{store.email}} indicando tu número de pedido y el motivo.
2. Te respondemos con las instrucciones para el envío o la entrega.
3. Cuando recibimos y revisamos el producto, procesamos el cambio o el reintegro.

**{{store.razon_social}}** · CUIT {{store.cuit}} · {{store.address}}
`;

const PRIVACY = `**{{store.razon_social}}** (CUIT {{store.cuit}}), con domicilio en {{store.address}}, es responsable del tratamiento de los datos personales que se recolectan a través de la tienda online **{{store.name}}**, en los términos de la **Ley 25.326 de Protección de los Datos Personales** y su reglamentación.

## Qué datos recolectamos

- **Datos que nos das al comprar:** nombre, email, teléfono, DNI o CUIT, dirección de entrega y los datos del pedido.
- **Datos de navegación:** información técnica del dispositivo y del navegador, páginas visitadas y cookies (ver más abajo).

No recolectamos datos de tarjetas de crédito ni claves bancarias: los pagos se hacen por transferencia o se coordinan directamente con nosotros.

## Para qué los usamos

- Procesar, preparar, entregar y facturar tus pedidos.
- Contactarte por el estado del pedido (email o WhatsApp).
- Atender consultas, cambios, devoluciones y reclamos.
- Cumplir obligaciones legales, contables e impositivas.
- Mejorar la tienda y, si lo aceptaste, enviarte novedades. Podés dejar de recibirlas cuando quieras.

## Con quién los compartimos

Sólo con quienes necesitamos para cumplir con tu pedido (empresas de transporte, proveedores de alojamiento y herramientas de la tienda) y con autoridades cuando la ley lo exija. **No vendemos ni cedemos tus datos** a terceros con fines comerciales.

## Cookies y herramientas de medición

La tienda usa cookies propias para funcionar (por ejemplo, para recordar tu carrito) y puede usar herramientas de medición y publicidad de terceros (como Google Analytics o Meta). Podés bloquear o borrar las cookies desde la configuración de tu navegador.

## Cuánto tiempo los guardamos

Conservamos los datos mientras sean necesarios para las finalidades descriptas y durante los plazos que exigen las normas contables e impositivas.

## Tus derechos

Como titular de los datos podés **acceder, rectificar, actualizar y pedir la supresión** de tus datos personales. Escribinos a {{store.email}}. El derecho de acceso puede ejercerse en forma gratuita a intervalos no inferiores a seis meses, salvo que acredites un interés legítimo (art. 14, inc. 3, Ley 25.326).

La **Agencia de Acceso a la Información Pública**, en su carácter de órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.

## Seguridad

Aplicamos medidas técnicas y organizativas razonables para proteger tus datos contra el acceso no autorizado, la pérdida o la alteración.

## Cambios en esta política

Podemos actualizar esta política. La versión vigente es la publicada en esta página.
`;

const TERMS = `Estos términos regulan el uso de la tienda online **{{store.name}}**, operada por **{{store.razon_social}}** (CUIT {{store.cuit}}), con domicilio en {{store.address}}. Al comprar en la tienda aceptás estos términos. Contacto: {{store.email}}.

## Productos y precios

- Los precios están expresados en pesos argentinos e incluyen IVA, salvo que se indique lo contrario.
- Las fotos son ilustrativas. Hacemos lo posible para que los colores y detalles se vean fieles, pero pueden variar según la pantalla.
- Los precios y la disponibilidad pueden cambiar sin previo aviso, pero **el precio que vale es el que se muestra al confirmar el pedido**.
- Las promociones y los cupones tienen las condiciones y la vigencia que se informan en cada caso y no son acumulables, salvo que se indique lo contrario.

## Cómo se compra

1. Agregás productos al carrito y completás tus datos, la forma de entrega y el medio de pago.
2. Al confirmar, el pedido queda registrado con un número y recibís un link para seguirlo.
3. El pedido se considera aceptado cuando confirmamos el stock y el pago.

## Medios de pago

- **Transferencia bancaria:** el descuento por transferencia, si existe, se muestra en el checkout. Reservamos el stock durante el plazo informado; si el pago no se acredita en ese plazo, el pedido puede cancelarse automáticamente.
- **Acordar con el vendedor:** coordinamos el pago y la entrega por WhatsApp.

## Envíos y retiros

Los costos y plazos de entrega se rigen por nuestra Política de envíos.

## Cambios, devoluciones y arrepentimiento

Tenés derecho a revocar la compra dentro de los 10 días corridos (art. 34, Ley 24.240) desde el Botón de arrepentimiento. Los detalles están en nuestra Política de cambios y devoluciones.

## Stock

Si luego de confirmar un pedido un producto no tuviera stock por un error, te lo informamos y podés elegir un reemplazo o el reintegro total de lo pagado.

## Propiedad intelectual

Los textos, fotos, logos y diseño de la tienda pertenecen a {{store.razon_social}} o a sus licenciantes y no pueden usarse sin autorización.

## Datos personales

Tratamos tus datos según nuestra Política de privacidad (Ley 25.326).

## Defensa del consumidor

Ante cualquier reclamo podés escribirnos a {{store.email}}. También podés acudir a la autoridad de aplicación de la Ley 24.240 (Defensa de las y los consumidores), desde el link que figura al pie de la tienda.

## Ley aplicable

Estos términos se rigen por las leyes de la República Argentina. En caso de controversia, serán competentes los tribunales correspondientes al domicilio del consumidor.
`;

export const LEGAL_TEMPLATES: Record<PolicyKey, LegalTemplate> = {
  shipping_md: { key: "shipping_md", title: "Envíos", slug: "envios", body: SHIPPING },
  returns_md: { key: "returns_md", title: "Cambios y devoluciones", slug: "cambios-y-devoluciones", body: RETURNS },
  privacy_md: { key: "privacy_md", title: "Privacidad", slug: "privacidad", body: PRIVACY },
  terms_md: { key: "terms_md", title: "Términos y condiciones", slug: "terminos", body: TERMS },
};

/** Plantilla lista para insertar, con los datos de la tienda. */
export function renderLegalTemplate(key: PolicyKey, vars: LegalTemplateVars): string {
  return fillLegalTemplate(LEGAL_TEMPLATES[key].body, vars);
}
