import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { GuideMeta } from "../types";

/*
 * Precios de terceros verificados el 2026-10-15 en sus sitios oficiales:
 * - Tiendanube: https://www.tiendanube.com/planes-y-precios (planes, pago mensual) y
 *   https://ayuda.tiendanube.com/es_AR/123484-costos-por-transaccion/que-son-los-costos-por-transaccion-de-tiendanube
 *   (costo por transacción por plan; ayuda actualizada el 25/03/2026).
 * - Empretienda: https://www.empretienda.com/ (precio único por mes, sin comisión) y /preguntas-frecuentes/.
 * - Shopify: https://www.shopify.com/ar/precios (USD, pago mensual; cargo con proveedores de pago externos).
 * La comisión de Mercado Pago no se cita: la fija Mercado Pago según el plazo de acreditación.
 * Si se actualizan estos números, cambiá también `VERIFIED`.
 */
const VERIFIED = "15 de octubre de 2026";

export const meta: GuideMeta = {
  slug: "cuanto-cuesta-una-tienda-online",
  title: "Cuánto cuesta de verdad tener una tienda online en Argentina (2026)",
  description: "Plan, comisión de la plataforma, comisión del medio de pago, dominio, fotos y tu tiempo: qué pagás en cada caso y una fórmula para hacer tu propia cuenta.",
  section: "Costos",
  publishedAt: "2026-10-15",
  updatedAt: "2026-10-15",
  readingMinutes: 6,
  cta: {
    title: "Pagás el plan y nada más: sin comisión por venta",
    text: "En Ecommy cobrás por transferencia o con tu propio Mercado Pago, y ningún porcentaje de tus ventas queda en la plataforma. Probalo 14 días con Pro, sin tarjeta.",
  },
};

export const body = (
  <>
    <p>
      «¿Cuánto cuesta una tienda online?» parece una pregunta con un número de respuesta, y casi nunca lo es. El precio del plan es lo que se ve
      primero, pero en la cuenta del mes entran otras cosas: un porcentaje que se queda la plataforma, otro que se queda el medio de pago, el
      dominio, las fotos y las horas que le dedicás. Esta guía las separa, muestra cómo cobran algunas plataformas conocidas y termina con una
      fórmula para que hagas tu propia cuenta con tus números.
    </p>

    <h2 id="los-costos">Los costos que se suman</h2>
    <ul>
      <li>
        <strong>El plan.</strong> Un monto fijo por mes (o por año, con descuento). Suele variar según la cantidad de productos, de usuarios y de
        funciones. Algunas plataformas tienen un plan gratis con tope.
      </li>
      <li>
        <strong>La comisión de la plataforma.</strong> Un porcentaje de cada venta que cobra la empresa de la tienda online, aparte del plan.
        No todas la cobran.
      </li>
      <li>
        <strong>La comisión del medio de pago.</strong> Lo que cobra quien procesa el pago con tarjeta: Mercado Pago, un banco u otra pasarela.
      </li>
      <li>
        <strong>El dominio.</strong> La dirección propia (tumarca.com.ar), que se paga por año.
      </li>
      <li>
        <strong>Las fotos y tu tiempo.</strong> No vienen en ninguna factura, pero son el costo más grande del primer mes.
      </li>
    </ul>

    <h2 id="dos-comisiones">Dos comisiones distintas que se confunden</h2>
    <p>
      Es la confusión más común. Cuando alguien dice «esa plataforma cobra comisión», puede estar hablando de dos cosas diferentes, y a veces
      se pagan las dos sobre la misma venta.
    </p>
    <ArticleTable
      head={["", "Comisión de la plataforma", "Comisión del medio de pago"]}
      rows={[
        ["Quién la cobra", "La empresa de la tienda online.", "Quien procesa el pago: Mercado Pago, la pasarela o el banco."],
        ["Por qué", "Por usar la plataforma, además del plan.", "Por cobrar con tarjeta, dinero en cuenta o cuotas."],
        ["Cuándo aplica", "Depende del plan y, a veces, del medio de pago que uses.", "En cada cobro que pasa por ese medio."],
        ["Se puede evitar", "Eligiendo una plataforma o un plan que no la cobre.", "Cobrando por transferencia; con tarjeta, no."],
      ]}
    />
    <p>
      La comisión de Mercado Pago la fija Mercado Pago y depende del plazo en que elegís recibir la plata: cuanto antes la querés disponible,
      más alto el porcentaje. Si además ofrecés cuotas sin interés, el costo de esa financiación lo pagás vos. Los valores vigentes están en{" "}
      <a href="https://www.mercadopago.com.ar/">el sitio de Mercado Pago</a> y, con tu cuenta abierta, en la sección de costos. Mirá ahí el
      porcentaje del plazo que tenés configurado, no uno que leíste en un foro.
    </p>
    <Callout tone="aviso">
      <p>
        Si una plataforma «no cobra comisión» sólo cuando usás su propio medio de pago, la comisión no desaparece: la cobra el medio de pago.
        Compará siempre la suma de las dos.
      </p>
    </Callout>

    <h2 id="plataformas">Cómo cobran algunas plataformas</h2>
    <p>
      Precios publicados en el sitio oficial de cada una, verificados el {VERIFIED}. Son los de pago mensual; con pago anual suelen ser más
      bajos. Cambian seguido: antes de decidir, mirá la página de cada una.
    </p>
    <ArticleTable
      head={["Plataforma", "Plan por mes", "Comisión de la plataforma por venta"]}
      rows={[
        [
          "Tiendanube",
          "Inicial gratis; Esencial $ 27.999, Impulso $ 79.999 y Escala $ 244.999.",
          "2 %, 1 % y 0,7 % según el plan, sobre ventas cobradas con medios distintos de Pago Nube (0 % con Pago Nube). El plan Inicial sólo funciona con Pago Nube.",
        ],
        ["Empretienda", "Precio único: $ 10.490.", "Sin comisión por venta."],
        ["Shopify", "Basic US$ 25, Grow US$ 65 y Advanced US$ 399.", "2 %, 1 % y 0,6 % si cobrás con un proveedor de pagos externo en lugar de Shopify Payments."],
        [
          "Ecommy",
          <span key="ecommy">
            Un plan gratis y planes mensuales: <Link href="/planes">ver los planes</Link>.
          </span>,
          "Sin comisión por venta.",
        ],
      ]}
    />
    <p>
      Fuentes: tiendanube.com/planes-y-precios y su centro de ayuda («Costos por transacción»), empretienda.com y shopify.com/ar/precios,
      consultados el {VERIFIED}. En todos los casos, si cobrás con tarjeta, a esto se suma la comisión del medio de pago. El centro de ayuda de
      Tiendanube aclara que su costo por transacción también corre sobre las ventas cargadas a mano y las cobradas con pagos personalizados.
    </p>

    <h2 id="perfiles">Qué pagás en cada caso</h2>
    <p>
      La plataforma más barata depende de cómo vendés. Tres perfiles reales y qué conviene mirar en cada uno:
    </p>
    <ArticleTable
      head={["Perfil", "Fijo por mes", "Por venta", "Qué mirar"]}
      rows={[
        [
          "Marca de ropa con 40 productos (talle y color) que cobra casi todo por transferencia",
          "Un plan que admita 40 productos con variantes.",
          "La transferencia, en general, no tiene comisión de medio de pago (revisá tu banco o billetera). La de la plataforma sí, si la cobra sobre ventas fuera de su pasarela.",
          "Si la plataforma cobra porcentaje sobre la transferencia: es el costo que más crece con tus ventas.",
        ],
        [
          "Comercio que cobra todo con tarjeta",
          "El plan.",
          "Siempre la comisión del medio de pago (según el plazo y las cuotas) y, según la plataforma, también la suya.",
          "El plazo de acreditación que elegiste y si la plataforma suma un porcentaje aparte.",
        ],
        [
          "Quien recién empieza con 15 productos",
          "Puede ser cero con un plan gratis, si el tope y las funciones te alcanzan.",
          "Lo mismo que los otros perfiles, según cómo cobres.",
          "Qué pasa cuando pasás el tope y si podés llevarte el catálogo si te mudás.",
        ],
      ]}
    />

    <h2 id="dominio-fotos-tiempo">Dominio, fotos y tu tiempo</h2>
    <p>
      <strong>Dominio.</strong> Muchas plataformas te dan una dirección gratis del tipo tumarca.plataforma.com. Un dominio propio se
      paga por año: los .com.ar se registran en NIC Argentina (nic.ar, con el arancel publicado ahí) y los .com, en un registrador
      internacional. Algunas plataformas lo conectan sólo desde ciertos planes; fijate en cuál.
    </p>
    <p>
      <strong>Fotos.</strong> Para una tienda de ropa no hace falta un estudio: con el celular, una ventana y un fondo liso alcanza para
      empezar. Lo contamos paso a paso en{" "}
      <Link href="/guias/fotos-de-producto-con-el-celular">la guía de fotos de producto con el celular</Link>. Si contratás a alguien, pedí
      precio por prenda y por foto entregada.
    </p>
    <p>
      <strong>Tiempo.</strong> Cargar el catálogo lleva horas: nombre, fotos, precio, talles, colores y stock de cada producto. Si ya lo tenés
      en una planilla, importarlo te ahorra la mayor parte (en <Link href="/ayuda/importar-csv">esta ayuda</Link> está cómo armar el CSV). Y
      después está el día a día: responder consultas, confirmar pagos, preparar envíos. Una plataforma que te ordena los pedidos también te
      devuelve horas, aunque no aparezca en la factura.
    </p>

    <h2 id="la-cuenta">Hacé tu propia cuenta</h2>
    <p>Con los números de un mes típico de tu negocio, la cuenta es esta:</p>
    <Callout tone="nota" title="La fórmula">
      <p>
        <strong>Costo del mes</strong> = plan + (ventas totales × % de la plataforma) + (ventas con tarjeta × % del medio de pago) + (dominio
        ÷ 12)
      </p>
    </Callout>
    <ol>
      <li>Sumá lo que vendiste en un mes normal y separá cuánto entró por transferencia y cuánto con tarjeta.</li>
      <li>Anotá el precio del plan que necesitás para tu cantidad de productos, no el más barato.</li>
      <li>Multiplicá tus ventas por el porcentaje de la plataforma, sólo sobre las ventas a las que se aplica.</li>
      <li>Multiplicá tus ventas con tarjeta por el porcentaje de tu medio de pago, el de tu plazo de acreditación.</li>
      <li>Sumá el dominio dividido por doce y repetí la cuenta con cada plataforma que estés comparando.</li>
    </ol>
    <p>
      Un ejemplo con números redondos: vendés $ 1.000.000 en el mes, $ 600.000 por transferencia y $ 400.000 con tarjeta. En una plataforma
      que cobra 2 % sobre todas tus ventas, son $ 20.000 por mes además del plan. En una sin comisión, ese renglón es cero. La comisión del
      medio de pago sobre los $ 400.000 con tarjeta la pagás en las dos.
    </p>
    <p>
      Hacé la cuenta con un mes bueno, no con uno flojo: el plan es fijo, pero el porcentaje crece con tus ventas. Y repetila cada tanto,
      porque los precios cambian. La plataforma más barata no es la del plan más bajo, sino la que te deja más plata a fin de mes vendiendo
      como vendés.
    </p>
  </>
);
