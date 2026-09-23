import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "remitos-y-exportar",
  title: "Imprimir remitos y exportar a CSV",
  description: "Remitos en hoja A4 o ticket de 80 mm, de a uno o varios juntos, y la exportación de productos, inventario, pedidos y clientes para tu contador o una planilla.",
  section: "pedidos",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 2,
  panel: { href: "/admin/pedidos", label: "Pedidos" },
};

export const body = (
  <>
    <p>
      Para armar paquetes con el papel en la mano y para pasarle los números a tu contador, el panel tiene dos herramientas: los remitos
      imprimibles, en todos los planes, y la exportación a CSV, desde el plan Pro.
    </p>

    <h2 id="remito">Imprimir un remito</h2>
    <p>
      En el detalle de un pedido tocá <strong>Imprimir remito</strong>. Se abre en otra pestaña una hoja lista para imprimir con:
    </p>
    <ul>
      <li>Tu logo, el número y la fecha del pedido.</li>
      <li>Los datos del cliente y la dirección de envío, o el aviso de que retira en el local.</li>
      <li>Los productos con su variante, SKU, cantidad y precio.</li>
      <li>Subtotal, descuentos, envío, total y método de pago.</li>
      <li>Las notas del cliente y un QR a la página del pedido para que siga el estado.</li>
    </ul>
    <p>
      Arriba elegís el <strong>Formato</strong>: <strong>Hoja A4</strong> o <strong>Ticket 80 mm</strong> para impresoras térmicas. Después,{" "}
      <strong>Imprimir</strong>. Si lo querés en archivo, elegí «Guardar como PDF» en el diálogo de impresión del navegador. El remito dice
      «Documento no válido como factura»: la factura la seguís haciendo con tu sistema de siempre.
    </p>

    <h2 id="varios">Varios remitos juntos</h2>
    <p>
      En <strong>Pedidos</strong>, tildá los pedidos que vas a despachar (por ejemplo, todos los de <strong>Por preparar</strong>) y, en la barra
      que aparece arriba de la tabla, tocá <strong>Imprimir remitos</strong>. Sale un remito por hoja. También está{" "}
      <strong>Imprimir remito</strong> en el menú de cada fila.
    </p>
    <Callout>
      <p>
        Un flujo que funciona: a la mañana filtrás <strong>Por preparar</strong>, imprimís todos los remitos, armás los paquetes con la hoja
        adentro y, a medida que salen, tocás <strong>Marcar enviado</strong> en cada pedido.
      </p>
    </Callout>

    <h2 id="exportar">Exportar a CSV</h2>
    <p>
      En <strong>Configuración › Exportar</strong> descargás cuatro archivos con <strong>Descargar CSV</strong>:
    </p>
    <ArticleTable
      head={["Archivo", "Qué trae"]}
      rows={[
        ["Productos y variantes", "Una fila por variante con categorías, opciones, SKU, precios, costo, stock, imagen y SEO. Es el mismo formato que acepta el importador."],
        ["Inventario", "SKU, producto, variante, stock, umbral de stock bajo, si se controla el stock y costo."],
        ["Pedidos", "Fecha, cliente con DNI o CUIT, subtotal, descuentos, envío, total, método y estado de pago, entrega y seguimiento. Se filtra por fechas, estado y pago."],
        ["Clientes", "Email, nombre, teléfono, documento, cantidad de pedidos, total gastado, etiquetas y fecha de alta."],
      ]}
    />
    <p>
      El de productos sirve para un truco útil: lo exportás, editás lo que quieras en la planilla y lo volvés a subir. Cómo hacerlo está en{" "}
      <Link href="/ayuda/importar-csv">Importar tu catálogo desde una planilla CSV</Link>. Desde <strong>Inventario</strong>, el botón{" "}
      <strong>Exportar CSV</strong> te lleva a la misma pantalla.
    </p>

    <h2 id="excel">Abrirlo bien en Excel</h2>
    <p>
      Los archivos están en UTF-8 y separados por comas; las fechas van en formato ISO y los montos sin separador de miles, con punto decimal.
      Google Sheets y Numbers los abren sin vueltas. En un Excel configurado en español, si al hacer doble click todo queda en una sola
      columna, abrilo desde <strong>Datos › Obtener datos › Desde texto/CSV</strong> y elegí coma como delimitador.
    </p>
    <p>Cada descarga queda registrada en la auditoría de la tienda, con el usuario y la fecha.</p>
  </>
);
