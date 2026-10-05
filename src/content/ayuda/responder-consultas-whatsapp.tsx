import { Callout } from "@/components/platform/ArticleCallout";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "responder-consultas-whatsapp",
  title: "Responder consultas de WhatsApp con precio, stock y link",
  description: "La pantalla Responder del panel: buscás el producto, elegís la variante y copiás la respuesta armada. Más las respuestas fijas de envío y pago.",
  section: "pedidos",
  publishedAt: "2026-10-05",
  updatedAt: "2026-10-05",
  readingMinutes: 2,
  panel: { href: "/admin/responder", label: "Responder" },
  related: ["compartir-tu-tienda", "zonas-de-envio"],
};

export const body = (
  <>
    <p>
      Te escriben por WhatsApp: “¿tenés la remera negra en M?”. En lugar de abrir Productos, mirar el stock y escribir la respuesta a mano,
      entrá a <strong>Responder</strong> (en el menú, debajo de Clientes). Buscás el producto, elegís la variante y copiás un mensaje que ya
      trae el precio, el stock y el link a la ficha.
    </p>
    <Callout tone="nota">
      <p>
        Ecommy no manda nada por vos. La respuesta queda lista y la mandás vos, desde tu WhatsApp, al chat que elijas.
      </p>
    </Callout>

    <h2 id="buscar">Buscar el producto</h2>
    <p>
      Escribí el nombre o el SKU: los resultados aparecen mientras escribís. Sin texto, ves los últimos productos que editaste. Cada
      resultado muestra la foto, cuántas variantes tienen stock y el precio. Tocá uno para abrirlo.
    </p>
    <p>
      Los productos en borrador aparecen marcados: el link todavía no abre para tu cliente, así que publicalo antes de mandarlo. Los
      archivados no aparecen.
    </p>

    <h2 id="respuesta">Elegir la variante y copiar la respuesta</h2>
    <p>
      Si el producto tiene variantes, elegí por cuál te preguntan o dejá <strong>Todo el producto</strong> para contestar con todas. La
      respuesta cambia según el caso:
    </p>
    <ul>
      <li>
        <strong>Con stock</strong>: “Sí, tenemos…”, el precio (o el rango, si las variantes salen distinto), el descuento por transferencia y
        las cuotas sin interés si las ofrecés, y el link.
      </li>
      <li>
        <strong>Pocas unidades</strong>: si quedan 3 o menos, la respuesta lo dice. Ayuda a cerrar la venta sin inventar urgencia.
      </li>
      <li>
        <strong>Sin stock</strong>: avisa que por ahora no queda, ofrece las otras variantes que sí tenés y le pide al cliente que deje su
        mail en la ficha para avisarle cuando vuelva.
      </li>
    </ul>
    <p>
      Los precios son los que ve el cliente en la tienda, con las promociones vigentes. Antes de copiar podés editar el texto. Después,{" "}
      <strong>Copiar respuesta</strong> lo deja en el portapapeles y <strong>Abrir WhatsApp</strong> abre WhatsApp con el mensaje escrito
      para que elijas el chat. Si la consulta termina en venta, <strong>Armar pedido</strong> te lleva al pedido manual.
    </p>

    <h2 id="siempre">Lo que preguntan siempre</h2>
    <p>Al costado (o abajo, en el celular) tenés respuestas fijas armadas con tus datos:</p>
    <ul>
      <li>Una por cada zona de envío activa, con el costo, el plazo y desde cuánto es gratis.</li>
      <li>Envío gratis desde un monto, si vale para todas tus zonas.</li>
      <li>Retiro en cada punto activo, con dirección y horarios.</li>
      <li>Cómo pagar: transferencia con su descuento, tarjeta y cuotas si tenés Mercado Pago conectado, y los datos para transferir.</li>
    </ul>
    <p>
      Si todavía no cargaste zonas o métodos de pago, la sección te lleva a <strong>Envíos</strong> o a{" "}
      <strong>Configuración › Pagos</strong>. Cuando los cambiás, las respuestas se actualizan solas.
    </p>
  </>
);
