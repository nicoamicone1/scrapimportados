import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "importar-desde-otra-tienda",
  title: "Importar desde tu tienda anterior (WooCommerce, Shopify u otra web)",
  description: "Pegás la dirección de tu tienda actual y traés productos, fotos, variantes y categorías como borrador, con recargo opcional. Después, volvés a sincronizar.",
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
      Si ya vendés en otra web, no hace falta cargar todo de nuevo. En <strong>Importar</strong>, pestaña{" "}
      <strong>Desde una tienda online</strong>, pegás la dirección y el importador lee el catálogo publicado. Está en el plan Pro y en la
      prueba de 14 días.
    </p>
    <Callout tone="aviso">
      <p>
        Importá sólo catálogos que tengas permiso de usar: el tuyo, el de tu proveedor o uno que te hayan autorizado. Textos y fotos de
        terceros pueden tener derechos de autor.
      </p>
    </Callout>

    <h2 id="que-se-trae">Qué se puede traer</h2>
    <ul>
      <li>Nombre, descripción, marca y etiquetas.</li>
      <li>Fotos: se descargan, se optimizan y se suben a tu tienda.</li>
      <li>Variantes (talle, color…) con precio, precio tachado, SKU y peso cuando el origen los publica.</li>
      <li>Categorías con su jerarquía.</li>
      <li>
        Stock: casi ninguna tienda publica la cantidad, sólo si hay o no hay. Por eso elegís cuánto cargar cuando la fuente dice «en stock»;
        si dice que no hay, queda en 0.
      </li>
    </ul>
    <p>
      Funciona con <strong>WooCommerce</strong>, <strong>Shopify</strong> y cualquier sitio que publique sus productos con datos estructurados
      (JSON-LD), que es lo que usa Google para mostrar precio y stock. No se traen pedidos, clientes ni reseñas.
    </p>

    <h2 id="detectar">Detectar antes de importar</h2>
    <p>
      En <strong>Dirección de la tienda, listado o sitemap</strong> pegás la URL (por ejemplo, la portada o una categoría). Dejá{" "}
      <strong>Tipo de tienda</strong> en <strong>Detectar automáticamente</strong> y tocá <strong>Detectar</strong>: te mostramos qué
      plataforma encontramos, cuántos productos y categorías hay y una muestra con precios. Si la muestra está vacía, podés intentar igual.
    </p>

    <h2 id="opciones">Las opciones que importan</h2>
    <ul>
      <li>
        <strong>Recargo sobre el precio de origen</strong>: por ejemplo 40 si el origen es tu proveedor mayorista. Con recargo, el precio de
        origen queda guardado como costo.
      </li>
      <li>
        <strong>Redondeo del precio final</strong>: al múltiplo de 10, 100 o 1.000 siguiente, o terminado en 990. Siempre redondea hacia arriba.
      </li>
      <li>
        <strong>Estado de los productos nuevos</strong>: dejalo en <strong>Borrador</strong>. Así no aparece nada en la tienda hasta que lo
        revises.
      </li>
      <li>
        <strong>Máximo de productos a traer</strong>: para probar, empezá con pocos. El total también cuenta contra el límite de productos de
        tu plan.
      </li>
      <li>
        <strong>Revisar antes de importar</strong>: primero se lee el catálogo y después elegís qué productos entran.
      </li>
    </ul>
    <p>
      Con <strong>Iniciar importación</strong> se abre el detalle con el progreso por fases. La importación avanza mientras esa página está
      abierta; podés <strong>Pausar</strong> y <strong>Reanudar</strong> cuando quieras, y sigue desde donde quedó.
    </p>

    <h2 id="despues">Después de importar</h2>
    <p>
      Los productos quedan en <strong>Productos › Borradores</strong>. Revisá fotos, categorías y precios, y publicalos. En cada producto
      importado, la tarjeta <strong>Origen</strong> muestra de dónde vino.
    </p>

    <h2 id="sincronizar">Volver a sincronizar</h2>
    <p>
      Si el origen sigue vivo (por ejemplo, la web de tu proveedor), en <strong>Historial</strong> abrís el menú de la importación y tocás{" "}
      <strong>Volver a sincronizar</strong>. Los productos se reconocen por su ID de origen y{" "}
      <strong>nunca se pisan el nombre, la descripción ni el estado</strong>.
    </p>
    <p>
      La sincronización repite las opciones de la importación original. Si querés cambiarlas, iniciá una importación nueva con la misma
      dirección: en <strong>Actualizar productos ya importados</strong> elegís con <strong>Sincronizar precios</strong> y{" "}
      <strong>Sincronizar stock</strong> qué se toca. Apagá precios si ajustaste alguno a mano y no querés perderlo.
    </p>
    <p>
      Los cambios de precio de una importación quedan en <strong>Precios › Historial de cambios</strong> y se pueden deshacer como cualquier
      cambio masivo (ver <Link href="/ayuda/cambiar-precios-en-masa">Cambiar muchos precios a la vez</Link>).
    </p>
    <Callout>
      <p>
        ¿Te mudás con dominio propio? Las direcciones viejas de tus productos tienen que redirigir a las nuevas para no perder lo que ganaste en
        Google. Lo explicamos en la guía{" "}
        <Link href="/guias/migrar-tienda-online-sin-perder-seo">Cómo migrar tu tienda online sin perder lo que ganaste en Google</Link>.
      </p>
    </Callout>
  </>
);
