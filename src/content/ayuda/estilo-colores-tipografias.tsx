import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "estilo-colores-tipografias",
  title: "Elegir un estilo y personalizar colores y tipografías",
  description: "Los 10 estilos por rubro, cómo probarlos sin tocar tu tienda, qué cambia cada sección del tema y cómo subir el logo, el favicon y la barra de anuncio.",
  section: "apariencia",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/apariencia", label: "Apariencia" },
};

export const body = (
  <>
    <p>
      <strong>Apariencia</strong> tiene dos pestañas: <strong>Tema</strong> (colores, tipografías, botones, tarjetas) y{" "}
      <strong>Marca y anuncio</strong> (logo, favicon y la barra de arriba). Todo lo que tocás se ve al instante en la vista previa de la
      derecha, con tus productos, y llega a la tienda recién cuando tocás <strong>Guardar</strong>.
    </p>

    <h2 id="preset">Elegir un estilo (preset)</h2>
    <p>
      Tu tienda arrancó con el estilo del rubro que elegiste al crearla. Hay 10: Nórdico, Mercado, Atelier, Editorial, Botica, Recreo,
      Lapacho, Galpón, Bodega y Neón. Cada uno es un punto de partida completo: colores, tipografías, forma de los botones y de las tarjetas.
    </p>
    <ol>
      <li>
        En la sección <strong>Preset</strong>, tocá <strong>Ver y comparar los 10 presets</strong>.
      </li>
      <li>
        Buscá por rubro o estilo («ropa», «ferretería», «cálido») o filtrá por <strong>Fondo</strong> claro u oscuro.
      </li>
      <li>Tocá uno para probarlo en la vista previa. No cambia nada hasta que lo aplicás.</li>
      <li>
        Con <strong>Aplicar</strong> reemplazás el tema entero (menos el CSS personalizado). Todavía podés volver atrás con{" "}
        <strong>Descartar</strong> hasta que guardes.
      </li>
    </ol>
    <p>
      En Free tenés Nórdico y Mercado; desde Starter, los 10. El filtro <strong>Sólo los de mi plan</strong> oculta los que no están incluidos.
    </p>

    <h2 id="colores">Colores</h2>
    <p>
      En <strong>Colores</strong> hay once: <strong>Fondo</strong>, <strong>Superficie</strong> (tarjetas, inputs, carrito),{" "}
      <strong>Texto</strong>, <strong>Texto secundario</strong>, <strong>Primario</strong> (el botón principal), <strong>Texto sobre
      primario</strong>, <strong>Secundario</strong> (bandas y barra de anuncio), <strong>Acento</strong> (precio en oferta),{" "}
      <strong>Bordes</strong>, <strong>Éxito</strong> y <strong>Error</strong>.
    </p>
    <p>
      Debajo, una lista controla el contraste de las combinaciones que importan: texto sobre fondo, texto del botón, precio en oferta. Si una
      queda en rojo con «mínimo 4.5», la gente la va a leer con esfuerzo, sobre todo en el celular a pleno sol. Oscurecé el texto o aclará el
      fondo hasta que diga AA.
    </p>

    <h2 id="tipografia">Tipografías</h2>
    <p>
      En <strong>Tipografía</strong> elegís una fuente para <strong>Títulos</strong> y otra para <strong>Texto</strong> (la de los nombres de
      producto, precios y botones), cada una con su peso. Cada opción de la lista se muestra con una frase de ejemplo para que la compares.
      También podés poner los títulos en mayúsculas, ajustar el espaciado de letras y el tamaño base.
    </p>
    <Callout>
      <p>
        Una buena regla: una fuente con personalidad para los títulos y una muy legible para el texto. Los precios se leen en la fuente del texto.
      </p>
    </Callout>

    <h2 id="resto">El resto del tema</h2>
    <ul>
      <li>
        <strong>Formas y botones</strong>: el redondeo general (de recto a máximo) y si el botón principal es sólido, de contorno o suave.
      </li>
      <li>
        <strong>Tarjetas de producto</strong>: plana, con borde o con sombra, la proporción de la foto y qué pasa al pasar el mouse. Acá también
        activás <strong>Precio con transferencia</strong> («$ 33.048 con transferencia» debajo del precio) y{" "}
        <strong>Precio sin impuestos nacionales</strong>, que además tiene que estar activado en Configuración.
      </li>
      <li>
        <strong>Encabezado</strong>: logo a la izquierda, al centro o mínimo; fijo al scrollear y transparente sobre la portada.
      </li>
      <li>
        <strong>Diseño y espacios</strong>, <strong>Pie de página</strong> y <strong>Efectos</strong>: densidad, columnas, redes sociales y
        sombras.
      </li>
    </ul>
    <p>
      Arriba de la vista previa cambiás entre <strong>Computadora</strong> y <strong>Celular</strong>. Revisá las dos antes de guardar: la
      mayoría de tus clientes va a entrar desde el teléfono. <strong>CSS personalizado</strong> queda para ajustes finos, desde el plan Pro.
    </p>

    <h2 id="marca">Logo, favicon y barra de anuncio</h2>
    <p>
      En <strong>Marca y anuncio</strong>:
    </p>
    <ul>
      <li>
        <strong>Logo</strong>: PNG con fondo transparente o SVG, horizontal. Sin logo, se muestra el nombre con la fuente de títulos.
      </li>
      <li>
        <strong>Favicon</strong>: cuadrado de 512 × 512 px, PNG o SVG. Es el ícono de la pestaña del navegador.
      </li>
      <li>
        <strong>Frase corta</strong>: qué vendés en una línea. Aparece en el pie y en Google.
      </li>
      <li>
        <strong>Barra de anuncio</strong>: una línea arriba del encabezado en todas las páginas. Usala para un dato concreto: «Envío gratis
        desde $ 60.000 a todo el país».
      </li>
    </ul>
    <p>
      La marca se guarda con <strong>Guardar marca</strong> y la barra con <strong>Guardar barra</strong>. Para armar la portada con bloques,
      seguí en <Link href="/ayuda/portada-y-paginas">Armar la portada y páginas con bloques</Link>.
    </p>
  </>
);
