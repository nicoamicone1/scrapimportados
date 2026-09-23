import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "analytics-pixel-tag-manager",
  title: "Google Analytics, Meta Pixel y Tag Manager en tu tienda",
  description: "Dónde pegar el ID de Google Analytics 4, del Pixel de Meta o de Tag Manager, qué eventos manda la tienda y cómo verificar tu tienda en Search Console.",
  section: "marketing",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 2,
  panel: { href: "/admin/configuracion/seo", label: "SEO e integraciones" },
  related: ["compartir-tu-tienda"],
};

export const body = (
  <>
    <p>
      Si pautás en Instagram o querés saber de dónde vienen tus ventas, necesitás medir. No hace falta tocar código: pegás el ID de cada
      herramienta y la tienda carga el script y manda los eventos. Está en{" "}
      <strong>Configuración › SEO e integraciones</strong>, en la parte <strong>Medición y publicidad</strong>, desde el plan Starter.
    </p>

    <h2 id="campos">Los cuatro campos</h2>
    <ArticleTable
      head={["Campo", "Qué pegar", "Dónde lo encontrás"]}
      rows={[
        ["Google Analytics 4", "El ID de medición: G-XXXXXXXXXX", "En Analytics, en Administrar › Flujos de datos, abriendo el flujo web de tu tienda."],
        ["Google Tag Manager", "El ID del contenedor: GTM-XXXXXXX", "Arriba de todo en el espacio de trabajo de Tag Manager."],
        ["Meta Pixel", "Sólo los números del ID", "En el Administrador de eventos de Meta, en el conjunto de datos de tu píxel."],
        ["Verificación de Google Search Console", "El código o la etiqueta meta completa", "En Search Console, al agregar la propiedad con el método de etiqueta HTML."],
      ]}
    />
    <p>
      Pegá sólo el ID, no el bloque de código que te dan las herramientas. En el campo de Search Console podés pegar la etiqueta entera: nos
      quedamos con el código. Después tocá <strong>Guardar</strong>.
    </p>

    <h2 id="eventos">Qué eventos manda la tienda</h2>
    <ArticleTable
      head={["Cuándo", "Google (GA4 / Tag Manager)", "Meta"]}
      rows={[
        ["Alguien ve un producto", <code key="g1">view_item</code>, <code key="m1">ViewContent</code>],
        ["Agrega al carrito", <code key="g2">add_to_cart</code>, <code key="m2">AddToCart</code>],
        ["Empieza el checkout", <code key="g3">begin_checkout</code>, <code key="m3">InitiateCheckout</code>],
        ["Confirma el pedido", <code key="g4">purchase</code>, <code key="m4">Purchase</code>],
      ]}
    />
    <p>
      La compra se registra una sola vez por pedido, cuando el cliente llega a la página de su pedido, con el número, el total, el envío y los
      productos.
    </p>
    <Callout tone="aviso">
      <p>
        Como la tienda no cobra con tarjeta, «compra» quiere decir <strong>pedido confirmado</strong>, no pagado. Si un cliente no te transfiere
        y el pedido vence, en Analytics igual figura. Para tus números reales de ventas, mirá el Dashboard, que cuenta los pedidos no
        cancelados.
      </p>
    </Callout>

    <h2 id="gtm">¿Analytics directo o por Tag Manager?</h2>
    <p>
      Elegí uno de los dos caminos. Si cargás el ID de GA4 acá y además configurás GA4 dentro de Tag Manager, cada visita se cuenta dos veces.
      Si no usás Tag Manager para otra cosa, lo más simple es pegar sólo el ID de GA4 y el del Pixel.
    </p>

    <h2 id="probar">Cómo comprobar que anda</h2>
    <ol>
      <li>Abrí tu tienda en una ventana de incógnito.</li>
      <li>Mirá un producto, agregalo al carrito y avanzá hasta el checkout.</li>
      <li>
        En Google Analytics, entrá a <strong>Informes › Tiempo real</strong>: tenés que verte como usuario activo y ver los eventos.
      </li>
      <li>En el Administrador de eventos de Meta, la opción de probar eventos muestra lo que llega en el momento.</li>
    </ol>
    <p>
      Si usás un bloqueador de anuncios, desactivalo para la prueba: bloquea estos scripts y vas a pensar que no funcionan.
    </p>

    <h2 id="search-console">Search Console</h2>
    <p>
      Search Console te dice con qué búsquedas aparece tu tienda en Google y si hay páginas con problemas. Agregá tu tienda como propiedad
      con el prefijo de URL (la dirección completa de tu tienda), elegí verificar con etiqueta HTML y pegá el código en el campo de
      verificación. Una vez verificada, enviá el sitemap: es la dirección de tu tienda seguida de <code>/sitemap.xml</code>.
    </p>
  </>
);
