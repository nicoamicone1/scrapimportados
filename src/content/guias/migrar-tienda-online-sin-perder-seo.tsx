import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { GuideMeta } from "../types";

export const meta: GuideMeta = {
  slug: "migrar-tienda-online-sin-perder-seo",
  title: "Cómo migrar tu tienda online sin perder lo que ganaste en Google",
  description: "La mudanza de plataforma en orden: inventario de URLs, importar el catálogo, redirecciones 301, dominio propio y Search Console, con un checklist para el día D.",
  section: "SEO",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 5,
  cta: {
    title: "Mudate con el catálogo y las redirecciones listas",
    text: "Ecommy importa tu catálogo desde WooCommerce, Shopify o una planilla, y carga las redirecciones 301 una por una o desde un CSV. Con 14 días de Pro para probarlo.",
  },
};

export const body = (
  <>
    <p>
      Cambiar de plataforma es una buena excusa para ordenar el catálogo, pero tiene un riesgo concreto: que las direcciones de tus productos
      cambien y Google, los links que circulan por WhatsApp y los que pusiste en Instagram empiecen a dar «página no encontrada». La mudanza
      bien hecha no se nota desde afuera. Esta guía va en el orden en que conviene hacerla.
    </p>

    <h2 id="que-se-pierde">Qué se pierde y qué no</h2>
    <p>
      Google no posiciona «tu tienda» en abstracto: posiciona direcciones concretas. La ficha de tu producto más vendido tiene una URL, y
      esa URL acumula historia: tiempo publicada, clics, links de otros sitios. Si después de la mudanza esa dirección da error, con el tiempo
      Google la saca de los resultados y la página nueva arranca de cero.
    </p>
    <p>
      Lo que conserva ese trabajo es la <strong>redirección 301</strong>: una instrucción que le dice al navegador y a Google «esta página se
      mudó para siempre a esta otra dirección». Bien cargadas, Google pasa a la dirección nueva lo que había ganado la vieja.
    </p>

    <h2 id="inventario">1. Antes de tocar nada: el inventario de URLs</h2>
    <p>Armá una planilla con todas las direcciones que hoy traen visitas. Tres fuentes:</p>
    <ul>
      <li>
        <strong>El sitemap de tu tienda actual</strong>, casi siempre en <code>tudominio.com/sitemap.xml</code>: lista productos, categorías y
        páginas.
      </li>
      <li>
        <strong>Google Search Console</strong>, en el informe de rendimiento: las páginas que más clics reciben desde Google.
      </li>
      <li>
        <strong>Google Analytics</strong>, si lo tenés: las páginas de entrada más visitadas.
      </li>
    </ul>
    <p>
      Sumá los links que vos mismo compartiste: el de la bio de Instagram, los de campañas y los que están en respuestas rápidas de WhatsApp.
      La planilla tiene tres columnas: URL vieja, tipo (producto, categoría, página) y URL nueva, que completás en el paso 3.
    </p>

    <h2 id="catalogo">2. Pasar el catálogo</h2>
    <p>
      Importá los productos con sus fotos, variantes, descripciones, precios y categorías, en lugar de cargarlos de nuevo: además de ahorrar
      días, conservás los textos que Google ya conoce. Dos detalles que después facilitan todo:
    </p>
    <ul>
      <li>
        <strong>Mantené los nombres y, si podés, el final de la URL</strong> de cada producto. Si en la tienda vieja era{" "}
        <code>/producto/mate-imperial</code>, que en la nueva siga terminando en <code>mate-imperial</code>.
      </li>
      <li>
        <strong>Revisá el título y la descripción para buscadores</strong> de tus productos más visitados: que no queden vacíos ni repetidos.
      </li>
    </ul>

    <h2 id="mapa">3. El mapa de redirecciones</h2>
    <p>
      Cada plataforma arma sus direcciones a su manera. Completá la columna «URL nueva» de tu planilla con la página equivalente. Algunos
      ejemplos típicos (la estructura exacta de tu tienda puede variar):
    </p>
    <ArticleTable
      head={["Venías de", "Dirección vieja", "Dirección nueva"]}
      rows={[
        ["WooCommerce", <code key="w">/producto/mate-imperial/</code>, <code key="w2">/producto/mate-imperial</code>],
        ["Shopify", <code key="s">/products/mate-imperial</code>, <code key="s2">/producto/mate-imperial</code>],
        ["Shopify (colección)", <code key="c">/collections/mates</code>, <code key="c2">/categoria/mates</code>],
      ]}
    />
    <p>Reglas para un mapa que funcione:</p>
    <ul>
      <li>
        <strong>Una a una, a la página más parecida.</strong> Un producto va a su producto; una categoría, a su categoría. Mandar todo a la
        portada es casi igual que no redirigir.
      </li>
      <li>
        <strong>Si un producto ya no existe</strong>, redirigilo a su categoría o al reemplazo más cercano.
      </li>
      <li>
        <strong>Sin cadenas.</strong> Si A redirige a B y B a C, cambiá A para que vaya directo a C.
      </li>
      <li>
        <strong>Siempre 301</strong>, la permanente. Una 302 le dice a Google que la mudanza es temporal.
      </li>
    </ul>
    <p>
      Después, cargá el mapa en la plataforma nueva. En Ecommy, por ejemplo, se cargan una por una o importando un CSV con dos columnas,{" "}
      <code>from</code> y <code>to</code>, y cuando cambiás la dirección de un producto la redirección se crea sola.
    </p>

    <h2 id="dominio">4. El dominio: lo que más te protege</h2>
    <p>
      Si tu tienda vieja usaba <strong>tu propio dominio</strong> (tutienda.com.ar), conservalo y apuntalo a la plataforma nueva. Es la mejor
      situación: las direcciones viejas llegan a la tienda nueva y las redirecciones hacen el resto.
    </p>
    <p>
      Si vendías en un <strong>subdominio de la plataforma anterior</strong> (tutienda.plataforma.com), ese subdominio no es tuyo: cuando
      cierres la cuenta, no vas a poder redirigir nada desde ahí. En ese caso, mantené la tienda vieja abierta unas semanas con un aviso que
      lleve a la nueva, actualizá todos los links que controlás y avisá a tus clientes. Y aprovechá para tener dominio propio desde ahora.
    </p>
    <Callout tone="aviso">
      <p>
        Para cambiar el dominio de plataforma tenés que modificar registros DNS en tu proveedor de dominio. El cambio puede tardar horas en
        propagarse. Hacelo en un horario de pocas ventas y no des de baja la tienda vieja hasta confirmar que la nueva responde.
      </p>
    </Callout>

    <h2 id="search-console">5. Search Console, antes y después</h2>
    <ul>
      <li>
        <strong>Antes</strong>: verificá que tenés acceso a la propiedad de tu dominio y guardá una copia de las páginas con más clics.
      </li>
      <li>
        <strong>El día de la mudanza</strong>: enviá el sitemap nuevo e inspeccioná tus diez páginas más importantes con la herramienta de
        inspección de URL para pedir que las rastree.
      </li>
      <li>
        <strong>Las semanas siguientes</strong>: mirá el informe de páginas y buscá errores 404. Cada 404 de una dirección vieja es una
        redirección que falta.
      </li>
      <li>
        <strong>Si cambiaste de dominio</strong>: con las 301 cargadas desde el dominio viejo, usá la herramienta de cambio de dirección de
        Search Console.
      </li>
    </ul>

    <h2 id="checklist">Checklist del día de la mudanza</h2>
    <ol>
      <li>Catálogo importado y revisado: fotos, precios, stock y categorías.</li>
      <li>Mapa de redirecciones cargado y probado con diez direcciones viejas al azar.</li>
      <li>Medios de pago, envíos y políticas configurados en la tienda nueva.</li>
      <li>Google Analytics, Meta Pixel y la verificación de Search Console cargados.</li>
      <li>Dominio apuntado y certificado de seguridad funcionando (la dirección abre con https).</li>
      <li>Sitemap nuevo enviado a Search Console.</li>
      <li>Link de la bio de Instagram, respuestas rápidas y firmas actualizados.</li>
      <li>Aviso a tus clientes: «nos mudamos, mismo lugar, tienda nueva».</li>
    </ol>

    <h2 id="despues">Qué esperar después</h2>
    <p>
      Es normal ver movimientos en Google durante algunas semanas mientras rastrea las direcciones nuevas y procesa las redirecciones. Lo que
      no es normal es que las páginas importantes desaparezcan: si pasa, casi siempre es una redirección que falta o que apunta mal. Revisá el
      informe de páginas una vez por semana durante el primer mes y corregí lo que aparezca. Con el inventario hecho, la mudanza es un trámite.
    </p>
  </>
);
