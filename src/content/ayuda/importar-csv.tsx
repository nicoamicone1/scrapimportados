import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "importar-csv",
  title: "Importar tu catálogo desde una planilla CSV",
  description: "Crear productos o actualizar precio y stock por SKU desde Excel o Google Sheets: columnas, formato, vista previa antes de aplicar y cómo leer los errores.",
  section: "catalogo",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/importar", label: "Importar" },
  related: ["cambiar-precios-en-masa"],
};

export const body = (
  <>
    <p>
      La planilla sirve para dos cosas: cargar un catálogo entero de una vez y, sobre todo, pasar a la tienda la lista de precios que te manda
      el proveedor. Está en <strong>Importar</strong>, pestaña <strong>Archivo CSV</strong>, desde el plan Starter. El plan también define
      cuántas importaciones podés hacer por mes; el contador aparece arriba del formulario.
    </p>

    <h2 id="modo">Elegí qué querés hacer</h2>
    <ul>
      <li>
        <strong>Actualizar por SKU</strong>: cambia precio, precio tachado, costo, stock y estado de variantes que ya existen en la tienda. No
        crea productos.
      </li>
      <li>
        <strong>Crear productos</strong>: una fila por variante. Las filas con el mismo <code>handle</code> son variantes del mismo producto. Es
        el mismo formato que la exportación de productos.
      </li>
    </ul>
    <p>
      Para cualquiera de los dos, <strong>Descargar plantilla</strong> te baja un CSV con los encabezados correctos. Empezá siempre desde ahí.
    </p>

    <h2 id="columnas">Las columnas</h2>
    <ArticleTable
      head={["Modo", "Obligatorias", "Opcionales"]}
      rows={[
        [
          "Actualizar por SKU",
          <code key="u1">sku</code>,
          <code key="u2">price, compare_at_price, cost, stock, status</code>,
        ],
        [
          "Crear productos",
          <code key="c1">name, price</code>,
          <code key="c2">handle, status, categories, tags, option1_name… option3_value, sku, barcode, compare_at_price, cost, stock, weight_grams, image_url, seo_title, seo_description, brand, description_html</code>,
        ],
      ]}
    />
    <p>Reglas que conviene tener presentes:</p>
    <ul>
      <li>
        Al actualizar, <strong>una celda vacía no cambia nada</strong>. Precio tachado o costo en 0 los quita.
      </li>
      <li>
        El estado acepta <code>draft</code>, <code>active</code> o <code>archived</code>, y también borrador, activo o archivado.
      </li>
      <li>
        Categorías con «&gt;» para la jerarquía y «|» entre varias: <code>Hogar &gt; Cocina | Ofertas</code>. Etiquetas e imágenes, separadas
        por «|».
      </li>
    </ul>

    <h2 id="archivo">El archivo</h2>
    <p>
      CSV separado por coma o por punto y coma, en UTF-8, de hasta 8 MB y 20.000 filas. En Excel: <strong>Archivo › Guardar como › CSV
      UTF-8</strong>. En Google Sheets: <strong>Archivo › Descargar › Valores separados por comas</strong>. Si tu planilla usa coma decimal, no
      pasa nada: la leemos igual.
    </p>
    <p>
      En <strong>Crear productos</strong> tenés además las opciones de la importación: un <strong>Recargo sobre el precio de origen</strong>{" "}
      (por ejemplo, 40 si la lista es mayorista), el <strong>Redondeo del precio final</strong>, el estado de los productos nuevos (conviene
      Borrador), qué hacer con las categorías y si descargar las imágenes de <code>image_url</code>.
    </p>

    <h2 id="vista-previa">Vista previa antes de aplicar</h2>
    <p>
      Tocá <strong>Subir y ver la vista previa</strong>. Se abre el detalle de la importación con el estado{" "}
      <strong>Esperando tu revisión</strong> y la lista <strong>Elegí qué importar</strong>: cada fila muestra qué cambia (por ejemplo, el
      precio viejo y el nuevo). Nada se aplica hasta que confirmás con <strong>Importar todos los pendientes</strong> o elegís algunas filas y
      tocás <strong>Importar seleccionados</strong>. Si algo no te cierra, <strong>Descartar</strong> anula todo lo pendiente.
    </p>

    <h2 id="errores">Si hay errores</h2>
    <p>
      Las filas con problemas quedan con estado <strong>Error</strong>, el número de fila del archivo y el motivo en la columna{" "}
      <strong>Motivo</strong>: «SKU no encontrado», un SKU repetido en el archivo, un precio que no es un número o una fila sin nombre. Las
      demás se aplican igual. Filtrá por <strong>Error</strong>, corregí esas filas en
      la planilla y subí sólo esas en un archivo nuevo. En <strong>Historial</strong>, abajo de la página, queda cada importación con lo que
      creó, actualizó, omitió y los errores.
    </p>
    <Callout tone="aviso">
      <p>
        El stock que entra por planilla queda registrado como movimiento de importación en <strong>Inventario</strong>. Los cambios de precio
        quedan en <strong>Precios › Historial de cambios</strong> y, desde el plan Pro, se pueden deshacer. Más en{" "}
        <Link href="/ayuda/cambiar-precios-en-masa">Cambiar muchos precios a la vez</Link>.
      </p>
    </Callout>
  </>
);
