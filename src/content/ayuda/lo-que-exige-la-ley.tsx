import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "lo-que-exige-la-ley",
  title: "Lo que te exige la ley en Argentina y cómo lo resuelve tu tienda",
  description: "Botón de arrepentimiento, precio sin impuestos nacionales, Data Fiscal, Defensa del Consumidor y políticas: qué pide cada norma y dónde se configura.",
  section: "legales",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/configuracion/legales", label: "Impuestos y legales" },
  related: ["pedidos-y-cobros", "primeros-pasos"],
};

export const body = (
  <>
    <Callout tone="legal">
      <p>
        Este artículo es orientativo y no es asesoramiento legal. Las normas cambian y tu caso puede tener particularidades: consultalo con tu
        contador o tu abogado.
      </p>
    </Callout>
    <p>
      Vender por internet en Argentina tiene reglas propias. Casi todo se resuelve en <strong>Configuración › Impuestos y legales</strong>; el
      resto viene activado de fábrica en todas las tiendas y en todos los planes.
    </p>

    <ArticleTable
      head={["Obligación", "Qué hace tu tienda", "Qué te toca a vos"]}
      rows={[
        ["Botón de arrepentimiento", "Link en el pie de todas las páginas, formulario sin registro y código de revocación.", "Responder cada solicitud dentro de las 24 h."],
        ["Precio sin impuestos nacionales", "Lo calcula y lo muestra junto al precio.", "Activarlo y revisar la alícuota de cada producto."],
        ["Data Fiscal", "Muestra el QR en el pie.", "Pedir el formulario 960/D en ARCA y cargar el QR."],
        ["Defensa del Consumidor", "Link al formulario de reclamos en el pie.", "Dejarlo activado."],
        ["Políticas", "Plantillas con tus datos y links en el pie.", "Revisarlas y adaptarlas a tu negocio."],
      ]}
    />

    <h2 id="arrepentimiento">Botón de arrepentimiento</h2>
    <p>
      La <a href="https://www.boletinoficial.gob.ar/detalleAviso/primera/235729/20201005">Resolución 424/2020 de la Secretaría de Comercio
      Interior</a> obliga a quien vende online a tener un botón de arrepentimiento visible desde la página de inicio. El cliente puede revocar
      la compra dentro de los 10 días corridos (artículo 34 de la Ley 24.240 de Defensa del Consumidor), sin registrarse y sin explicar el
      motivo, y el comercio tiene que informarle un código de revocación dentro de las 24 horas.
    </p>
    <p>
      Tu tienda muestra el link <strong>Botón de arrepentimiento</strong> en el pie. El formulario pide nombre, un email o teléfono de
      contacto, el número de pedido y un motivo opcional, y le muestra al cliente su código apenas lo envía. Vos recibís la solicitud en{" "}
      <strong>Pedidos › Arrepentimientos</strong> (el botón muestra cuántas hay nuevas) y, si cargaste el email de contacto, también por mail.
      Desde ahí la <strong>Procesás</strong> (con la opción de cancelar el pedido en el mismo paso; el stock vuelve) o la{" "}
      <strong>Rechazás</strong> si no corresponde, por ejemplo fuera de plazo. En los dos casos, avisale al cliente por el mismo medio.
    </p>

    <h2 id="precio-sin-impuestos">Precio sin impuestos nacionales</h2>
    <p>
      La Ley 27.743 y la{" "}
      <a href="https://www.boletinoficial.gob.ar/detalleAviso/primera/319787/20250117">Resolución 4/2025 de la Secretaría de Industria y
      Comercio</a> piden mostrar, junto al precio final, el precio sin IVA ni otros impuestos nacionales indirectos, con la leyenda «Precio sin
      impuestos nacionales». Activá <strong>Mostrar el precio sin impuestos</strong> y elegí la <strong>Alícuota de IVA por defecto</strong>{" "}
      (21 % en la mayoría de los productos). Si un producto lleva otra, la cambiás en su ficha, en <strong>Impuestos</strong>. El cálculo es
      precio final ÷ (1 + alícuota): un producto de $ 12.100 con 21 % muestra $ 10.000. Se ve en la tarjeta, la ficha, el carrito y el
      checkout; en las tarjetas depende además del interruptor de <strong>Apariencia › Tarjetas de producto</strong>.
    </p>
    <p>
      Si sos monotributista no discriminás IVA y podés dejarlo apagado; confirmalo con tu contador. El detalle, con ejemplos, está en la guía{" "}
      <Link href="/guias/precio-sin-impuestos-nacionales">Precio sin impuestos nacionales</Link>.
    </p>

    <h2 id="data-fiscal">Data Fiscal</h2>
    <p>
      ARCA (ex AFIP) te da un código QR para la web con el formulario 960/D. El código que te entrega es un script para pegar en el sitio; por
      seguridad no aceptamos scripts, así que cargás dos datos que están adentro: la <strong>URL de la imagen del QR</strong> (termina en .jpg o
      .png) y el <strong>Link del QR</strong> (la dirección que empieza con qr.afip.gob.ar). En el formulario ves la vista previa tal como va a
      quedar en el pie.
    </p>

    <h2 id="datos">Datos del comercio y Defensa del Consumidor</h2>
    <p>
      Completá <strong>CUIT</strong> y <strong>Razón social</strong> como figuran en ARCA: se muestran en el pie y completan las plantillas de
      políticas. Dejá activado <strong>Link a Defensa del Consumidor</strong>, que lleva al formulario oficial de reclamos.
    </p>

    <h2 id="politicas">Políticas</h2>
    <p>
      En <strong>Políticas</strong> hay cuatro: Envíos, Cambios y devoluciones, Privacidad (con lo que pide la Ley 25.326 de Protección de
      Datos Personales) y Términos y condiciones. <strong>Insertar plantilla</strong> escribe un texto base con tus datos. Leelo entero y
      adaptalo: los plazos de cambio, quién paga el envío de una devolución y los medios de contacto son decisiones tuyas. Cada política
      publicada aparece en el pie de la tienda.
    </p>
  </>
);
