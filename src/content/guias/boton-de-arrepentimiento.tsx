import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { GuideMeta } from "../types";

export const meta: GuideMeta = {
  slug: "boton-de-arrepentimiento",
  title: "Botón de arrepentimiento: qué exige la ley argentina a tu tienda online",
  description: "Qué pide la Resolución 424/2020: un link visible en la página de inicio, 10 días corridos para revocar y un código en 24 horas. Cómo cumplir y cómo responder.",
  section: "Legales",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 5,
  cta: {
    title: "El botón de arrepentimiento, resuelto de fábrica",
    text: "En Ecommy el link está en el pie de todas las páginas, el formulario le da al cliente su código y la solicitud te llega a una bandeja en el panel.",
  },
};

export const body = (
  <>
    <Callout tone="legal">
      <p>
        Esta guía es orientativa y no reemplaza el asesoramiento de un profesional. Resume normas vigentes a la fecha de actualización; ante un
        caso concreto, consultá con tu abogado.
      </p>
    </Callout>
    <p>
      Si vendés por internet en Argentina, tu tienda tiene que tener un botón de arrepentimiento. No es un detalle de diseño: es una obligación
      con fecha, plazos y un procedimiento. Acá va qué pide la norma, cómo se cuentan los plazos y cómo manejar una solicitud sin
      complicarte.
    </p>

    <h2 id="origen">De dónde sale la obligación</h2>
    <p>
      El derecho a arrepentirse de una compra a distancia no es nuevo. El artículo 34 de la Ley 24.240 de Defensa del Consumidor le da al
      comprador 10 días corridos para revocar la aceptación, «sin responsabilidad alguna», cuando compró fuera del local, por ejemplo por
      internet o por teléfono. El Código Civil y Comercial recoge el mismo derecho para los contratos a distancia en su artículo 1110.
    </p>
    <p>
      Lo nuevo llegó con la{" "}
      <a href="https://www.boletinoficial.gob.ar/detalleAviso/primera/235729/20201005">Resolución 424/2020 de la Secretaría de Comercio
      Interior</a>, publicada en el Boletín Oficial en octubre de 2020. La resolución definió cómo se ejerce ese derecho en la práctica: con
      un botón visible en el sitio del vendedor.
    </p>

    <h2 id="que-pide">Qué te pide la resolución, en concreto</h2>
    <ul>
      <li>
        <strong>Un link visible desde la página de inicio</strong>, con la leyenda «Botón de arrepentimiento», de acceso fácil y directo. No
        vale esconderlo dentro de «Ayuda» o de «Mi cuenta».
      </li>
      <li>
        <strong>Sin trámites previos.</strong> El cliente no tiene que registrarse ni loguearse para usarlo.
      </li>
      <li>
        <strong>Un código de identificación</strong> de la solicitud, que el vendedor tiene que informarle al cliente dentro de las 24 horas,
        por el mismo medio que usó para pedirla.
      </li>
    </ul>
    <p>
      El formulario puede pedir lo mínimo para identificar la compra: nombre, un email o teléfono de contacto y el número de pedido. El motivo,
      si lo pedís, tiene que ser opcional: la ley no le exige al cliente explicar por qué se arrepiente.
    </p>

    <h2 id="plazo">Cómo se cuentan los 10 días</h2>
    <p>
      Son <strong>días corridos</strong>, no hábiles: cuentan sábados, domingos y feriados. Según la Ley 24.240, el plazo corre desde que se
      entrega el producto o desde que se celebra el contrato, lo último que ocurra. En una tienda online, casi siempre es la fecha de entrega.
    </p>
    <ArticleTable
      head={["Situación", "Desde cuándo se cuenta"]}
      rows={[
        ["Pedido con envío a domicilio", "Desde que el cliente recibe el paquete."],
        ["Retiro en el local", "Desde que lo retira."],
        ["Pagó hoy y el producto llega en una semana", "Desde la entrega, no desde el pago."],
      ]}
    />
    <p>
      Si el cliente recibió el pedido el día 3, puede arrepentirse hasta el día 13. Guardá la fecha de entrega de cada pedido (el aviso del
      transporte o la firma del remito): es lo que vas a mirar si una solicitud llega sobre el límite. Ante la duda, contá a favor del cliente.
    </p>

    <h2 id="gastos">Quién paga la devolución</h2>
    <p>
      El mismo artículo 34 establece que el comprador pone el producto a disposición del vendedor y que los gastos de devolución corren por
      cuenta del vendedor. En la práctica: coordinás el retiro o le decís al cliente cómo mandarlo sin costo para él, y cuando lo recibís le
      devolvés lo que pagó.
    </p>
    <p>
      El Código Civil y Comercial prevé excepciones en su artículo 1116, por ejemplo productos hechos según las indicaciones del cliente o
      que por su naturaleza no pueden devolverse o se deterioran rápido. Si vendés algo así, aclaralo en tu política de cambios y devoluciones
      y consultalo antes de aplicarlo.
    </p>

    <h2 id="diferencias">Arrepentimiento, garantía y cambio no son lo mismo</h2>
    <ArticleTable
      head={["", "Arrepentimiento", "Garantía", "Cambio"]}
      rows={[
        ["Qué es", "Devolver sin dar razones.", "El producto falla o vino mal.", "Otro talle, otro color."],
        ["Plazo", "10 días corridos.", "El de la garantía legal o el tuyo, si es mayor.", "El que definas en tu política."],
        ["Qué recibe el cliente", "Lo que pagó.", "Reparación, cambio o devolución.", "Otro producto."],
      ]}
    />
    <p>
      Mezclarlos genera la mayoría de los conflictos: un cliente que pide un cambio de talle dentro de los 10 días está usando tu política de
      cambios, no el botón. Explicá las tres cosas por separado en tu política de cambios y devoluciones.
    </p>

    <h2 id="cumplir">Cómo cumplir en tu tienda</h2>
    <ol>
      <li>
        Poné el link «Botón de arrepentimiento» en el pie de todas las páginas, empezando por la de inicio. En tiendas armadas con Ecommy ya
        viene así; en otras plataformas, revisá que no quede escondido.
      </li>
      <li>Armá un formulario sin registro con los datos mínimos y el motivo opcional.</li>
      <li>Hacé que cada solicitud genere un código y que el cliente lo reciba.</li>
      <li>Centralizá las solicitudes en un solo lugar, con fecha y hora, para poder responder dentro de las 24 horas.</li>
      <li>Informá el derecho de revocación en tu política de cambios y en la confirmación de compra.</li>
    </ol>

    <h2 id="solicitud">Qué hacer cuando llega una solicitud</h2>
    <ol>
      <li>
        <strong>Respondé dentro de las 24 horas</strong>, por el mismo medio que dejó el cliente, con el código de la solicitud.
      </li>
      <li>
        <strong>Verificá el pedido y el plazo.</strong> Si está fuera de los 10 días o no corresponde a tu tienda, explicale el motivo.
      </li>
      <li>
        <strong>Coordiná la devolución</strong> sin costo para el cliente.
      </li>
      <li>
        <strong>Recibí el producto</strong> y revisá que sea el que vendiste.
      </li>
      <li>
        <strong>Devolvé el dinero</strong> por el mismo medio de pago, cancelá el pedido y reingresá el stock.
      </li>
    </ol>

    <h2 id="errores">Errores comunes</h2>
    <ul>
      <li>El link existe pero está dentro de una sección que el cliente no encuentra desde la portada.</li>
      <li>Pedir que se registre, que llame por teléfono o que escriba un mail para ejercer el derecho.</li>
      <li>Hacer obligatorio el motivo o condicionar la devolución a que lo explique.</li>
      <li>Cobrarle el envío de vuelta.</li>
      <li>No contestar, o contestar después de varios días.</li>
    </ul>
    <p>
      Bien resuelto, el botón casi no genera trabajo y le da al comprador una razón más para confiar en una tienda que todavía no conoce.
    </p>
  </>
);
