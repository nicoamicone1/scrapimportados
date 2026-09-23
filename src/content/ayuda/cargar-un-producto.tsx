import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "cargar-un-producto",
  title: "Cargar un producto con variantes, fotos y stock",
  description: "El formulario de producto campo por campo: fotos, precio y stock, talles y colores como variantes, categorías, IVA y cómo publicarlo o dejarlo en borrador.",
  section: "catalogo",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/productos/nuevo", label: "Nuevo producto" },
};

export const body = (
  <>
    <p>
      Entrás por <strong>Productos › Nuevo producto</strong>. El formulario tiene una columna principal (nombre, fotos, precio, variantes) y un
      lateral (estado, organización, impuestos). Arriba de todo, <strong>Crear producto</strong> guarda; también funciona Ctrl+S.
    </p>

    <h2 id="basico">Nombre y descripción</h2>
    <ul>
      <li>
        <strong>Nombre</strong> es el único campo obligatorio para empezar. Usá el nombre con el que te lo piden: «Remera oversize de algodón»
        dice más que «Remera modelo 3».
      </li>
      <li>
        <strong>Descripción</strong> es texto con formato: medidas, materiales, cuidados, qué incluye.
      </li>
      <li>
        <strong>Descripción corta</strong> (hasta 300 caracteres) se usa en listados y, si no completás el SEO, en Google.
      </li>
    </ul>

    <h2 id="fotos">Fotos</h2>
    <p>
      En <strong>Imágenes</strong> tocás <strong>Subir imágenes</strong>, las arrastrás o las pegás con Ctrl+V. Aceptamos JPG, PNG, WebP, GIF,
      AVIF y SVG, y las optimizamos solas (WebP, 1600 px como máximo). La primera es la principal, la que se ve en los listados: arrastralas
      para cambiar el orden. En el menú de cada foto tenés <strong>Hacer principal</strong>, <strong>Texto alternativo</strong> (una
      descripción para Google y para quien usa lector de pantalla) y <strong>Borrar</strong>.
    </p>
    <p>
      Si el producto es nuevo, al subir la primera foto lo guardamos como borrador; por eso te pedimos el nombre antes. La cantidad de fotos por
      producto depende del plan: cuando llegás al tope, te avisamos arriba de las fotos.
    </p>

    <h2 id="precio">Precio y stock de un producto simple</h2>
    <p>Si el producto no tiene talles ni colores, completás todo en <strong>Precio, stock y variantes</strong>:</p>
    <ul>
      <li>
        <strong>Precio</strong> (obligatorio) y <strong>Precio tachado</strong>, el anterior, para mostrar una oferta.
      </li>
      <li>
        <strong>Costo</strong>: no se muestra en la tienda y te sirve para calcular márgenes y el valor del inventario.
      </li>
      <li>
        <strong>SKU</strong> y <strong>Código de barras</strong>. El SKU es la llave para actualizar precios y stock desde una planilla.
      </li>
      <li>
        <strong>Stock</strong> y <strong>Aviso de stock bajo</strong>. Si lo dejás vacío, el aviso usa el umbral de la tienda.
      </li>
      <li>
        <strong>Controlar stock</strong>: sin tildar, el producto se vende siempre. <strong>Vender sin stock</strong> deja comprar aunque llegue
        a cero (útil para productos por encargo).
      </li>
    </ul>

    <h2 id="variantes">Talles, colores y otras variantes</h2>
    <p>
      Tocá <strong>Agregar opciones (talle, color…)</strong> o los atajos <strong>+ Talle</strong> y <strong>+ Color</strong>. En cada opción
      escribís los <strong>Valores</strong> y apretás Enter; también podés pegar varios separados por coma: «S, M, L». Con dos opciones (Talle y
      Color) se arman todas las combinaciones solas. Hay hasta 3 opciones y 250 variantes por producto.
    </p>
    <p>
      Aparece una tabla con una fila por variante: precio, tachado, costo, stock, SKU, código de barras, umbral y peso. Con{" "}
      <strong>Aplicar a todas</strong> cargás el mismo precio o el mismo stock de una vez. En la miniatura de cada fila le asignás una de las
      fotos del producto, y el interruptor <strong>Activa</strong> saca de la venta una combinación que no fabricás.
    </p>
    <Callout tone="aviso">
      <p>Si borrás un valor de una opción, sus variantes se eliminan al guardar. Para pausar una sola combinación, desactivala.</p>
    </Callout>

    <h2 id="organizacion">Categorías, etiquetas e IVA</h2>
    <p>
      En el lateral, <strong>Organización</strong> tiene <strong>Categorías</strong>, <strong>Marca</strong> y <strong>Etiquetas</strong> (sirven
      para agrupar en bloques de la portada y en precios masivos). En <strong>Impuestos</strong>, la <strong>Alícuota de IVA</strong> queda en
      «Por defecto de la tienda» salvo que el producto lleve 10,5 %, 27 % o esté exento: se usa para mostrar el{" "}
      <Link href="/ayuda/lo-que-exige-la-ley">precio sin impuestos nacionales</Link>.
    </p>

    <h2 id="publicar">Borrador, publicado y archivado</h2>
    <p>
      En <strong>Estado</strong> elegís <strong>Activo</strong> (visible y a la venta), <strong>Borrador</strong> (no se ve; lo revisás con{" "}
      <strong>Vista previa</strong>) o <strong>Archivado</strong> (oculto, conserva su historial). <strong>Destacado</strong> lo suma a los
      bloques de destacados de la portada.
    </p>
    <p>
      Para cargar un modelo parecido, abrí el menú de tres puntos de arriba (<strong>Más acciones</strong>) y tocá{" "}
      <strong>Duplicar</strong>: se crea una copia en borrador, sin SKU, código de barras ni
      stock, y elegís si copiar las fotos. Si cerrás la pestaña sin guardar, la próxima vez te ofrecemos <strong>Recuperar cambios</strong>.
    </p>
    <p>
      Cuando cambiás el stock de un producto que ya existe, aparece <strong>Motivo del ajuste de stock</strong>: lo que escribas queda en{" "}
      <strong>Inventario</strong>, en el historial de movimientos, con tu usuario y la fecha.
    </p>
  </>
);
