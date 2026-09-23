import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "zonas-de-envio",
  title: "Zonas de envío: mapa, provincias, códigos postales y retiro",
  description: "Dibujá en el mapa hasta dónde llegás, cobrá por provincia o código postal, ofrecé retiro en el local y envío gratis desde un monto. Y probá una dirección antes.",
  section: "envios",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/envios", label: "Envíos" },
  related: ["pedidos-y-cobros", "primeros-pasos"],
};

export const body = (
  <>
    <p>
      En <strong>Envíos</strong> definís a dónde llegás, cuánto cuesta y en cuánto tiempo. En el checkout, el cliente escribe su dirección y la
      tienda le calcula el costo con la zona que le corresponde. La página tiene tres pestañas: <strong>Zonas</strong>,{" "}
      <strong>Retiro en local</strong> y <strong>Probar dirección</strong>.
    </p>

    <h2 id="tipos">Cuatro formas de armar una zona</h2>
    <p>
      Con <strong>Nueva zona</strong> elegís el <strong>Tipo de zona</strong>:
    </p>
    <ArticleTable
      head={["Tipo", "Para qué sirve"]}
      rows={[
        ["Polígono", "Dibujás el área en el mapa. Ideal si repartís vos: «Palermo y Belgrano», «dentro de la General Paz»."],
        ["Provincias", "Una o varias provincias enteras, por ejemplo todo Buenos Aires."],
        ["Códigos postales", "Prefijos de código postal: 1900, 19, B1878."],
        ["Todo el país", "Cualquier dirección de Argentina. Es el comodín: va última."],
      ]}
    />
    <p>
      En todas completás el <strong>Nombre</strong> (el cliente lo ve en el checkout), el <strong>Costo del envío</strong> (0 si es siempre
      gratis), <strong>Envío gratis desde</strong> (opcional: el subtotal a partir del cual no cobrás) y la <strong>Demora</strong>, en texto
      libre: «24 a 48 h hábiles». Las <strong>Notas internas</strong> sólo las ve tu equipo.
    </p>

    <h2 id="mapa">Dibujar en el mapa</h2>
    <ol>
      <li>
        Buscá tu barrio o ciudad en <strong>Buscá un barrio, ciudad o dirección</strong> para centrar el mapa.
      </li>
      <li>
        Tocá <strong>Dibujar polígono</strong> y hacé click en el mapa para marcar los vértices (mínimo 3).
      </li>
      <li>Para cerrar: doble click, Enter o click en el primer punto. El click derecho deshace el último punto.</li>
      <li>
        Para ajustar, arrastrá los vértices. Click en un punto intermedio agrega uno; click derecho sobre un vértice lo borra.
      </li>
    </ol>
    <p>
      Una zona puede tener varios polígonos: con <strong>Dibujar otro polígono</strong> sumás un área separada con el mismo costo. Si ya tenés el
      área en geojson.io, QGIS o Google My Maps, usá <strong>Importar GeoJSON</strong>.
    </p>

    <h2 id="codigos">Provincias y códigos postales</h2>
    <p>
      En <strong>Provincias incluidas</strong> tildás las que quieras (o <strong>Seleccionar todas</strong>). En{" "}
      <strong>Prefijos de código postal</strong> los separás con coma o salto de línea: «19» incluye todos los que empiezan con 19, del 1900 al
      1999. Si pegás un código completo como B1900ABC, se toman los números.
    </p>

    <h2 id="orden">El orden importa</h2>
    <p>
      Las zonas se evalúan de arriba hacia abajo y <strong>gana la primera que incluye la dirección</strong>. Poné primero lo más chico y
      barato (tu barrio), después lo más amplio (la provincia) y al final «Todo el país». Para reordenar, arrastrá cada fila desde el asa de la
      izquierda. Las zonas nuevas se agregan al final.
    </p>
    <Callout tone="aviso">
      <p>
        Si ninguna zona activa incluye una dirección, el cliente ve «Todavía no llegamos a tu zona» y puede escribirte por WhatsApp o elegir
        retiro. Para no perder esas ventas, sumá una zona «Todo el país» al final.
      </p>
    </Callout>

    <h2 id="probar">Probar una dirección</h2>
    <p>
      En <strong>Probar dirección</strong> escribís calle, número, ciudad, código postal y provincia, y opcionalmente el subtotal del carrito.
      Te decimos qué zona le toca, cuánto paga y si aplica el envío gratis, igual que en el checkout. También podés hacer click en el mapa para
      probar un punto.
    </p>

    <h2 id="retiro">Retiro en el local</h2>
    <p>
      En <strong>Retiro en local › Nuevo punto de retiro</strong> cargás el <strong>Nombre</strong>, la <strong>Dirección</strong> (la ubicamos
      en el mapa; si no queda exacta, arrastrá el pin), los <strong>Horarios</strong> y las <strong>Instrucciones para retirar</strong>, por
      ejemplo «Traé el número de pedido y tu DNI». Los puntos activos aparecen en el checkout sin costo de envío.
    </p>

    <h2 id="gratis">La barra de envío gratis</h2>
    <p>
      En <strong>Configuración › Pagos y checkout › Barra de envío gratis</strong> activás el aviso del carrito «Te faltan $ X para el envío
      gratis». Si dejás vacío el monto, se usa el menor «Envío gratis desde» de tus zonas y la barra aclara «en zonas seleccionadas».
    </p>
  </>
);
