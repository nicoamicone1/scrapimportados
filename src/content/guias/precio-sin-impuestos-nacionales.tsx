import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";
import { formatMoney } from "@/lib/money";
import { netPrice } from "@/lib/pricing";

import type { GuideMeta } from "../types";

export const meta: GuideMeta = {
  slug: "precio-sin-impuestos-nacionales",
  title: "Precio sin impuestos nacionales: cómo mostrarlo bien en tu tienda",
  description: "Qué piden la Ley 27.743 y la Resolución SIC 4/2025, cómo calcular el precio sin IVA con la alícuota correcta y dónde mostrarlo en tu tienda, con ejemplos.",
  section: "Impuestos",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 5,
  cta: {
    title: "El precio sin impuestos, calculado en cada producto",
    text: "En Ecommy activás la leyenda, elegís la alícuota por defecto y la de cada producto, y el precio sin impuestos se actualiza con cada cambio de precio.",
  },
};

/** Un ejemplo de la tabla: precio final, alícuota y neto calculado con la misma función que usan las tiendas. */
function row(label: string, final: number, vat: number) {
  return [label, formatMoney(final), `${String(vat).replace(".", ",")} %`, formatMoney(netPrice(final, vat))];
}

const WRONG = 12100 * 0.79;

/* Carrito mixto del ejemplo: una lámpara al 21 % y un libro exento. */
const LAMP = 36300;
const BOOK = 23500;
const CART_NET = netPrice(LAMP, 21) + netPrice(BOOK, 0);
const CART_WRONG = netPrice(LAMP + BOOK, 21);

export const body = (
  <>
    <Callout tone="legal">
      <p>
        Esta guía es orientativa y no reemplaza el asesoramiento de tu contador. La alícuota de cada producto y si la obligación te alcanza
        dependen de tu situación fiscal.
      </p>
    </Callout>
    <p>
      Desde 2025, en las góndolas y en las tiendas online aparece una línea nueva debajo del precio: «Precio sin impuestos nacionales». Es la
      parte del precio que queda después de sacar el IVA y los otros impuestos nacionales indirectos. Mostrarla bien lleva una fórmula, la
      alícuota correcta de cada producto y un lugar fijo en la tienda.
    </p>

    <h2 id="norma">Qué exige la norma</h2>
    <p>
      La Ley 27.743 creó el Régimen de Transparencia Fiscal al Consumidor, que busca que quien compra sepa cuántos impuestos paga. Para la
      exhibición de precios, la{" "}
      <a href="https://www.argentina.gob.ar/normativa/nacional/norma-408455/texto">Resolución 4/2025 de la Secretaría de Industria y
      Comercio</a> pide mostrar, junto al precio final, el importe sin IVA ni otros impuestos nacionales indirectos, con la leyenda «Precio sin
      impuestos nacionales», y es exigible desde abril de 2025.
    </p>
    <p>En la práctica, para una tienda online eso significa:</p>
    <ul>
      <li>El precio final, el que paga el cliente, sigue siendo el protagonista.</li>
      <li>Al lado o debajo, en una tipografía menor, el precio sin impuestos con su leyenda.</li>
      <li>Aplica a cada lugar donde se ofrece el precio: listados, ficha del producto, carrito y checkout.</li>
    </ul>

    <h2 id="formula">La fórmula</h2>
    <p>
      El precio final ya incluye el IVA. Para sacarlo, no se resta un porcentaje: se divide.
    </p>
    <p>
      <strong>Precio sin impuestos = precio final ÷ (1 + alícuota)</strong>
    </p>
    <p>
      Con 21 %, la alícuota es 0,21 y se divide por 1,21. Algunos ejemplos, calculados con dos decimales:
    </p>
    <ArticleTable
      head={["Producto", "Precio final", "Alícuota", "Sin impuestos nacionales"]}
      rows={[
        row("Remera de algodón", 12100, 21),
        row("Auriculares vincha", 45990, 21),
        row("Carne vacuna, 1 kg", 14000, 10.5),
        row("Libro", 23500, 0),
      ]}
    />
    <Callout tone="aviso">
      <p>
        El error más común es multiplicar por 0,79 («le saco el 21 %»). Con la remera de {formatMoney(12100)} daría {formatMoney(WRONG)}, cuando
        el precio sin IVA es {formatMoney(netPrice(12100, 21))}. La diferencia crece con el precio.
      </p>
    </Callout>

    <h2 id="alicuota">Qué alícuota usar</h2>
    <ul>
      <li>
        <strong>21 %</strong>: la general. La mayoría de la ropa, la tecnología, los artículos del hogar y la deco.
      </li>
      <li>
        <strong>10,5 %</strong>: una alícuota reducida para ciertos productos, por ejemplo las carnes, frutas y verduras frescas y los bienes
        de capital.
      </li>
      <li>
        <strong>27 %</strong>: existe para algunos servicios; es raro verla en una tienda de productos.
      </li>
      <li>
        <strong>0 %</strong>: productos exentos, como los libros. El precio sin impuestos es igual al final.
      </li>
    </ul>
    <p>
      Si tu catálogo mezcla alícuotas, necesitás poder definirla por producto y no una sola para toda la tienda. Pedile a tu contador la lista
      de lo que no va al 21 %: suelen ser pocos productos y se cargan una vez.
    </p>

    <h2 id="otros">Los otros impuestos nacionales indirectos</h2>
    <p>
      La leyenda habla de «impuestos nacionales», no sólo del IVA. Algunos productos pagan además impuestos internos, por ejemplo las
      bebidas alcohólicas. En esos casos, el precio sin impuestos tiene que descontar también ese componente y la fórmula
      simple no alcanza. Si vendés algo alcanzado, definí el cálculo con tu contador.
    </p>

    <h2 id="donde">Dónde mostrarlo y cómo</h2>
    <ArticleTable
      head={["Lugar", "Qué mostrar"]}
      rows={[
        ["Listados y tarjetas de producto", "Precio final grande y, debajo, «Precio sin impuestos nacionales: $ X» en letra más chica."],
        ["Ficha del producto", "Lo mismo, al lado del precio. Si hay variantes con precios distintos, el de la variante elegida."],
        ["Carrito y checkout", "El total sin impuestos nacionales junto al total a pagar."],
      ]}
    />
    <p>
      En una oferta, el precio sin impuestos se calcula sobre el precio de oferta, que es el que efectivamente paga el cliente. Y si el precio
      cambia, el neto tiene que cambiar con él: por eso conviene que lo calcule el sistema y no escribirlo a mano en cada descripción.
    </p>

    <h2 id="carrito">Un carrito con dos alícuotas</h2>
    <p>
      En el carrito y en el checkout, el total sin impuestos se arma producto por producto, cada uno con su alícuota. Aplicar un único 21 % al
      total da un número equivocado apenas el carrito mezcla productos distintos.
    </p>
    <ArticleTable
      head={["Producto", "Precio final", "Alícuota", "Sin impuestos nacionales"]}
      rows={[
        row("Lámpara de mesa", LAMP, 21),
        row("Libro de fotografía", BOOK, 0),
        ["Total", formatMoney(LAMP + BOOK), "", formatMoney(CART_NET)],
      ]}
    />
    <p>
      Si se dividiera el total de {formatMoney(LAMP + BOOK)} por 1,21, el carrito mostraría {formatMoney(CART_WRONG)} sin impuestos: menos de
      lo que corresponde, porque al libro no se le descuenta IVA. Por eso, si tu sistema calcula el neto del carrito, conviene que lo haga
      sumando línea por línea y no sobre el total.
    </p>

    <h2 id="monotributo">¿Y si sos monotributista?</h2>
    <p>
      Los monotributistas no discriminan IVA en sus comprobantes, y hay criterios distintos sobre cómo aplica la exhibición en su caso. No lo
      resuelvas por tu cuenta: definilo con tu contador y, si te corresponde mostrarlo, usá la misma fórmula.
    </p>

    <h2 id="errores">Errores comunes</h2>
    <ul>
      <li>Calcular el neto multiplicando por 0,79 en vez de dividir por 1,21.</li>
      <li>Usar el 21 % para productos que llevan 10,5 % o están exentos.</li>
      <li>Mostrarlo en la ficha pero no en el carrito ni en el checkout.</li>
      <li>Escribirlo a mano y olvidarse de actualizarlo con el aumento siguiente.</li>
      <li>Darle más protagonismo que al precio final.</li>
    </ul>

    <h2 id="checklist">Checklist</h2>
    <ol>
      <li>Confirmá con tu contador si la obligación te alcanza y qué alícuota lleva cada producto.</li>
      <li>Cargá una alícuota por defecto para la tienda y la excepción en cada producto que no vaya al 21 %.</li>
      <li>Activá la leyenda en tarjetas, ficha, carrito y checkout.</li>
      <li>Revisá tres productos a mano con la fórmula para confirmar que los números cierran.</li>
      <li>Después de cada aumento masivo, mirá un par de productos: el neto tiene que haber cambiado.</li>
    </ol>
    <p>
      Si tu plataforma lo calcula sola a partir de la alícuota (en Ecommy, por ejemplo, se activa una vez y cada producto lleva la suya),
      esta obligación te lleva una tarde. Si no, sumala a la rutina de cada cambio de precios.
    </p>
  </>
);
