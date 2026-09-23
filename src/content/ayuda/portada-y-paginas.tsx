import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "portada-y-paginas",
  title: "Armar la portada y páginas con bloques",
  description: "Cómo editar la portada, qué hace cada bloque, cómo elegir qué productos muestra, y la diferencia entre guardar un borrador y publicar.",
  section: "apariencia",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/paginas", label: "Páginas" },
  related: ["estilo-colores-tipografias"],
};

export const body = (
  <>
    <p>
      La portada y el resto de las páginas se arman apilando bloques: una portada con foto, un carrusel de productos, un texto, preguntas
      frecuentes. Todo está en <strong>Páginas</strong>; para ir directo a la de inicio, tocá <strong>Editar portada</strong>.
    </p>

    <h2 id="editor">El editor en tres columnas</h2>
    <ul>
      <li>
        A la izquierda, <strong>Bloques</strong>: la lista en orden. Arrastrás para reordenar y cada bloque tiene botones para ocultarlo,
        duplicarlo y borrarlo.
      </li>
      <li>
        En el centro, la vista previa con tu tema y tus productos. Arriba cambiás entre <strong>Computadora</strong> y{" "}
        <strong>Celular</strong>. Un click en un bloque de la vista previa lo selecciona.
      </li>
      <li>A la derecha, la configuración del bloque seleccionado: textos, imágenes, links y su estilo.</li>
    </ul>
    <p>
      <strong>Agregar bloque</strong> (abajo de la lista) abre la paleta; el bloque nuevo se agrega debajo del que tenés seleccionado. Atajos:
      Ctrl+S guarda, Ctrl+D duplica y Supr borra.
    </p>

    <h2 id="bloques">Qué hace cada bloque</h2>
    <ArticleTable
      head={["Bloque", "Para qué"]}
      rows={[
        ["Portada", "Imagen grande con título y un botón. Para abrir la página con una campaña concreta."],
        ["Banners", "De 1 a 4 imágenes con link: accesos a colecciones."],
        ["Cuenta regresiva", "Hasta una fecha; al terminar muestra un texto de cierre."],
        ["Carrusel de productos", "Una fila que se desliza: novedades, una categoría, ofertas."],
        ["Grilla de productos", "Productos en las columnas que elijas."],
        ["Categorías", "Accesos a categorías como tarjetas, chips o círculos con foto."],
        ["Título, Texto enriquecido, Imagen y texto", "Contar quién sos, explicar cómo comprás o una política."],
        ["Beneficios", "Hasta 4 datos operativos: envíos, retiro, formas de pago."],
        ["Preguntas frecuentes", "Preguntas y respuestas desplegables."],
        ["Testimonios", "Reseñas reales de clientes. Nace vacío."],
        ["Video y Separador", "Un video que carga al tocar play; una línea o un espacio."],
      ]}
    />
    <p>
      En los bloques de productos elegís de dónde salen: <strong>Lo más nuevo</strong>, <strong>Destacados</strong> (los que marcaste con el
      interruptor en el producto), <strong>En oferta</strong>, <strong>De una categoría</strong>, <strong>Con una etiqueta</strong> o{" "}
      <strong>Elegidos a mano</strong>. Se actualizan solos cuando cambian tus productos.
    </p>
    <Callout tone="aviso">
      <p>
        En Testimonios usá sólo reseñas reales, con permiso de quien las escribió. Una reseña inventada engaña a tu cliente y te expone a un
        reclamo.
      </p>
    </Callout>

    <h2 id="estilo">El estilo de cada bloque</h2>
    <p>
      En la sección <strong>Estilo</strong> de cada bloque elegís el <strong>Fondo</strong> (el de la página, superficie, color primario u
      otro), el <strong>Espacio arriba y abajo</strong>, el <strong>Ancho</strong> y si se oculta en celulares. Alternar un fondo distinto cada
      dos o tres bloques ordena la lectura sin agregar cajas.
    </p>

    <h2 id="publicar">Guardar, publicar y descartar</h2>
    <p>
      Si la página ya está publicada, <strong>Guardar borrador</strong> guarda tus cambios sin tocar la tienda: tus clientes siguen viendo la
      versión anterior hasta que toques <strong>Publicar cambios</strong>. Si te arrepentís, en el menú de tres puntos está{" "}
      <strong>Descartar borrador</strong>, que vuelve a lo que está publicado. En una página nueva, los botones son <strong>Guardar</strong> y{" "}
      <strong>Publicar</strong>.
    </p>

    <h2 id="paginas">Páginas nuevas</h2>
    <p>
      Con <strong>Nueva página</strong> ponés el <strong>Título</strong>, la <strong>Dirección</strong> (se completa sola) y elegís desde
      dónde empezar: <strong>Vacía</strong>, <strong>Landing de campaña</strong>, <strong>Sobre nosotros</strong> o{" "}
      <strong>Página legal</strong>. Las plantillas traen bloques con texto de ejemplo para reemplazar. Las páginas extra están desde el plan
      Starter; en Free tenés la portada.
    </p>
    <p>
      En el menú de tres puntos, <strong>Datos y SEO de la página</strong> tiene el título para Google, la dirección, la imagen para compartir
      (1200 × 630 px) y <strong>Mostrar en el menú</strong>. Si cambiás la dirección de una página publicada, la vieja redirige sola a la nueva.
    </p>
  </>
);
