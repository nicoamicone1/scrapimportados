import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "cambiar-precios-en-masa",
  title: "Cambiar muchos precios a la vez y deshacer",
  description: "Aumentos por porcentaje, monto o margen, por categoría, marca o etiqueta, con redondeo, vista previa y un Deshacer que respeta lo que cambiaste después.",
  section: "catalogo",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/precios", label: "Precios" },
  related: ["importar-csv"],
};

export const body = (
  <>
    <p>
      Cuando llega un aumento del proveedor no hace falta tocar producto por producto. En el menú, <strong>Marketing › Precios</strong> arma el
      cambio en tres pasos y te muestra cómo queda cada variante antes de aplicar. Está en el plan Pro y lo pueden usar el dueño y los
      administradores de la tienda.
    </p>

    <h2 id="rapido">El atajo: Aumento rápido</h2>
    <p>
      Arriba de todo, en <strong>Aumento rápido</strong>, escribís el porcentaje en <strong>Aumentar todo el catálogo</strong> y tocás{" "}
      <strong>Preparar</strong>. No aplica nada: completa los pasos de abajo para que revises la vista previa.
    </p>

    <h2 id="alcance">1. Alcance: a qué variantes</h2>
    <p>
      En <strong>Tipo de alcance</strong> elegís <strong>Todo el catálogo</strong>, <strong>Por categorías</strong> (con{" "}
      <strong>Incluir subcategorías</strong>), <strong>Por productos</strong>, <strong>Por marca</strong>, <strong>Por etiqueta</strong> o{" "}
      <strong>Por rango de precio</strong>. Con <strong>Sólo variantes con stock</strong> dejás afuera las agotadas. Los productos archivados
      nunca se tocan.
    </p>

    <h2 id="regla">2. Regla: qué cambio</h2>
    <ArticleTable
      head={["Qué querés hacer", "Ejemplo"]}
      rows={[
        ["Aumentar o bajar un porcentaje", "Aumentar 8 % por inflación."],
        ["Aumentar o bajar un monto fijo", "Sumar $ 500 a cada precio."],
        ["Fijar precio según costo + margen", "40 % sobre un costo de $ 1.000 da $ 1.400. Las variantes sin costo se omiten."],
        ["Fijar precio tachado", "Con 20 %, un precio de $ 10.000 muestra tachado $ 12.000."],
        ["Quitar precio tachado", "Deja sólo el precio actual."],
        ["Armar una oferta", "Con 15 %, $ 10.000 pasa a $ 8.500 y $ 10.000 queda tachado."],
      ]}
    />
    <p>Tres ajustes que evitan precios raros:</p>
    <ul>
      <li>
        <strong>Aplicar lo mismo al precio tachado</strong>: si la variante tiene tachado, se ajusta igual y la oferta se mantiene.
      </li>
      <li>
        <strong>Redondeo</strong>: a 10, a 100, a 1.000, terminar en 990 o en 99; en <strong>Hacia</strong> elegís al más cercano, hacia arriba o
        hacia abajo.
      </li>
      <li>
        <strong>No bajar de</strong> y <strong>No superar</strong>: topes opcionales. Si un precio los toca, la vista previa lo marca.
      </li>
    </ul>

    <h2 id="vista-previa">3. Vista previa y aplicar</h2>
    <p>
      La vista previa lista cada variante con su precio actual y el nuevo. Los filtros <strong>Cambian</strong>, <strong>Omitidas</strong>,{" "}
      <strong>Sin cambios</strong> y <strong>Excluidas a mano</strong> te dejan revisar por partes. Destildá una fila para dejarla afuera.
      Cuando esté bien, tocá <strong>Aplicar a N variantes</strong> y confirmá: el cambio se ve en la tienda al instante.
    </p>

    <h2 id="deshacer">Deshacer</h2>
    <p>
      Apenas aplicás, el aviso de abajo trae un botón <strong>Deshacer</strong> durante unos segundos. Después, el cambio queda en{" "}
      <strong>Historial de cambios</strong> (el botón de arriba a la derecha en Precios): cada fila muestra la regla, el alcance, cuántas
      variantes tocó, quién lo hizo y si está <strong>Aplicado</strong> o <strong>Deshecho</strong>. Los cambios que entraron por una
      importación aparecen como «Importación». La flecha a la izquierda de cada fila abre el detalle por variante, con el antes y el después.
    </p>
    <p>
      <strong>Deshacer</strong> vuelve a los precios anteriores, pero sólo en las variantes que nadie tocó después. Si cambiaste a mano el
      precio de una remera después del aumento, esa remera queda como la dejaste y el historial lo marca con «cambió después».
    </p>
    <Callout tone="aviso">
      <p>
        Con muchos productos, conviene hacer primero un cambio chico (una categoría) para ver cómo queda el redondeo. Siempre podés deshacerlo.
      </p>
    </Callout>
    <p>
      Si la lista del proveedor viene con precios por SKU y no como porcentaje, es más directo subirla en planilla: está en{" "}
      <Link href="/ayuda/importar-csv">Importar tu catálogo desde una planilla CSV</Link>.
    </p>
  </>
);
