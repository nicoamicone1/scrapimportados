import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { GuideMeta } from "../types";

export const meta: GuideMeta = {
  slug: "vender-por-whatsapp-sin-perder-pedidos",
  title: "Cómo vender por WhatsApp sin perder pedidos: catálogo, stock y pedidos ordenados",
  description: "Dónde se pierden las ventas cuando todo pasa por el chat y cómo ordenarlo: catálogo con precio y stock, pedido completo, cobro por transferencia y seguimiento.",
  section: "Ventas",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 5,
  cta: {
    title: "Tu catálogo con carrito, y el pedido te llega armado por WhatsApp",
    text: "Ecommy registra cada pedido con productos, total, envío y datos del cliente antes de abrir el chat. Cobrás por transferencia o como acuerden, sin comisión por venta.",
  },
};

export const body = (
  <>
    <p>
      En Argentina, WhatsApp es el mostrador de miles de comercios. La gente pregunta, compra y paga por ahí, y funciona hasta que deja de
      funcionar: un día con veinte conversaciones abiertas, alguien que transfirió y no sabés por qué pedido, una remera que vendiste dos veces.
      El problema no es WhatsApp. Es que el chat se usa para todo a la vez: vidriera, lista de precios, planilla de stock y libro de pedidos.
    </p>
    <p>Esta guía propone separar esas funciones sin dejar de vender por WhatsApp.</p>

    <h2 id="donde-se-pierden">Dónde se pierden los pedidos</h2>
    <ul>
      <li>
        <strong>La consulta que no respondiste a tiempo.</strong> «¿Precio?» a las 23 h. A la mañana, esa persona ya le compró a otro.
      </li>
      <li>
        <strong>El pedido desparramado.</strong> El talle en un mensaje, el color en un audio, la dirección tres días después. Para armar el
        paquete hay que releer todo el chat.
      </li>
      <li>
        <strong>El stock de memoria.</strong> Le dijiste que sí a dos personas por la última unidad, o frenaste una venta de algo que tenías.
      </li>
      <li>
        <strong>El comprobante sin pedido.</strong> Llega una captura de una transferencia de $ 38.500 y no sabés a quién corresponde.
      </li>
      <li>
        <strong>El «¿y mi pedido?».</strong> Cada cliente pregunta por su envío, y cada pregunta es un rato tuyo.
      </li>
    </ul>

    <h2 id="catalogo">1. Un catálogo con precio y stock a la vista</h2>
    <p>
      La mitad de los mensajes son preguntas que un catálogo contesta solo: precio, talles, colores, si hay. Hay tres formas de tenerlo, de
      menor a mayor orden:
    </p>
    <ArticleTable
      head={["Opción", "A favor", "En contra"]}
      rows={[
        ["Fotos y un PDF con precios", "Rápido de armar.", "Se desactualiza con cada aumento; no dice qué hay en stock."],
        ["Catálogo de WhatsApp Business", "Está dentro del chat y el cliente puede mandarte un carrito.", "No lleva el stock por talle ni calcula el envío; el pedido llega como un mensaje más."],
        ["Tienda online con carrito", "Precio, variantes y stock al día; el cliente elige todo solo.", "Hay que cargar el catálogo una vez (o importarlo)."],
      ]}
    />
    <p>
      Cualquiera sea la opción, el objetivo es el mismo: que a la pregunta «¿precio?» le puedas contestar con un link, y que el link muestre la
      verdad.
    </p>

    <h2 id="pedido">2. Que el pedido llegue completo</h2>
    <p>
      Un pedido completo tiene todo lo necesario para prepararlo sin volver a preguntar. Si falta algo de esta lista, vas a tener que escribir
      otra vez:
    </p>
    <ul>
      <li>Productos con su variante (talle, color) y cantidad.</li>
      <li>Precio de cada uno, descuentos y total.</li>
      <li>Cómo lo recibe: envío con dirección y costo, o retiro.</li>
      <li>Nombre, teléfono y, si hace falta factura, DNI o CUIT.</li>
      <li>Cómo va a pagar.</li>
      <li>Un número de pedido.</li>
    </ul>
    <p>
      La manera más simple de lograrlo es que el cliente lo arme solo en un carrito y que al confirmar se abra WhatsApp con el pedido escrito.
      Es lo que hace Ecommy, por ejemplo: el pedido queda registrado en el panel antes de abrir el chat, así que aunque la charla se corte, la
      venta no se pierde. Si seguís sin carrito, armá una plantilla de pedido y pedile al cliente que la complete.
    </p>

    <h2 id="respuestas">3. Respuestas rápidas y etiquetas</h2>
    <p>WhatsApp Business tiene dos herramientas gratis que casi nadie aprovecha:</p>
    <ul>
      <li>
        <strong>Respuestas rápidas</strong>: textos guardados que insertás con un atajo. Por ejemplo, «/catalogo» con el link de tu tienda,
        «/pago» con tu alias y el monto a transferir, «/envios» con las zonas y los costos.
      </li>
      <li>
        <strong>Etiquetas</strong>: marcás cada chat como «Pedido nuevo», «Esperando pago», «Pagado» o «Enviado». Al final del día, filtrás
        por etiqueta y sabés qué falta.
      </li>
    </ul>
    <p>
      Configurá también el mensaje de bienvenida y el de ausencia con el link del catálogo: la consulta de las 23 h se contesta sola.
    </p>

    <h2 id="stock">4. Una sola fuente de verdad para el stock</h2>
    <p>
      Si vendés por WhatsApp, por Instagram y en el local, el stock tiene que vivir en un solo lugar y descontarse con cada venta, venga de donde
      venga. Dos reglas prácticas:
    </p>
    <ol>
      <li>
        <strong>Reservá al recibir el pedido, no al cobrarlo.</strong> Si esperás el pago para descontar, podés vender la misma unidad dos
        veces.
      </li>
      <li>
        <strong>Poné plazo a la reserva.</strong> Si en 24 o 48 horas no llega el pago, liberá el stock y avisale al cliente. Sin plazo, cada
        pedido abandonado deja productos «agotados» que en realidad tenés.
      </li>
    </ol>
    <p>
      Las ventas del local o de un chat que no pasaron por el carrito también se cargan: si no, el stock deja de ser confiable en una semana.
    </p>

    <h2 id="cobro">5. Cobrar sin perder comprobantes</h2>
    <p>
      La transferencia es el medio más barato para vos y el que más se usa en ventas por WhatsApp. Para que cada pago encuentre su pedido:
    </p>
    <ul>
      <li>Pasá siempre el mismo bloque de datos: alias, CBU o CVU, titular y el monto exacto.</li>
      <li>Pedí que pongan el número de pedido en el concepto o en el mensaje del comprobante.</li>
      <li>
        Si ofrecés descuento por transferencia, mostralo desde el principio, al lado del precio. Si recién aparece al final, no ayuda a
        decidir.
      </li>
      <li>Cuando ves la plata en tu cuenta, marcá el pedido como pagado en el mismo momento, no «a la noche».</li>
    </ul>
    <Callout tone="aviso">
      <p>
        No despaches con la captura del comprobante: controlá que el dinero esté acreditado en tu cuenta. Una captura se puede editar.
      </p>
    </Callout>

    <h2 id="seguimiento">6. Avisar antes de que pregunten</h2>
    <p>
      Cada cambio de estado que avisás vos es un «¿y mi pedido?» menos. Con tres mensajes alcanza: «recibimos tu pago», «lo despachamos, este
      es el seguimiento» y «llegó». Si tu sistema le da al cliente un link para ver el estado de su pedido, mandalo junto con la confirmación y
      ahorrás la mayoría de esas preguntas.
    </p>

    <h2 id="rutina">Una rutina de quince minutos</h2>
    <p>El orden no depende de una herramienta sino de un hábito. Dos veces por día:</p>
    <ol>
      <li>Revisá los pedidos nuevos y confirmá stock.</li>
      <li>Cruzá las transferencias acreditadas con los pedidos pendientes de pago y marcalos.</li>
      <li>Liberá las reservas vencidas y avisá a esos clientes.</li>
      <li>Prepará lo pagado y mandá el seguimiento de lo que salió.</li>
      <li>Contestá las consultas con respuestas rápidas y el link del producto.</li>
    </ol>
    <p>
      Con el catálogo a la vista, pedidos completos y el stock en un solo lugar, WhatsApp vuelve a ser lo que tiene que ser: el canal donde
      conversás con tus clientes, no el lugar donde se pierden las ventas.
    </p>
  </>
);
