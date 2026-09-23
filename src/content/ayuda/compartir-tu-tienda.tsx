import { Callout } from "@/components/platform/ArticleCallout";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "compartir-tu-tienda",
  title: "Compartir tu tienda: link, QR y mensajes listos",
  description: "La sección Compartir del panel: copiar el link, descargar el QR para el mostrador, mensajes para Instagram y WhatsApp y el link directo a un producto.",
  section: "marketing",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 2,
  panel: { href: "/admin/compartir", label: "Compartir" },
  related: ["analytics-pixel-tag-manager", "primeros-pasos"],
};

export const body = (
  <>
    <p>
      Una tienda que nadie visita no vende. En el menú, <strong>Marketing › Compartir</strong> junta todo lo que necesitás para mandar gente:
      el link, el QR y mensajes armados con tus datos reales (descuento por transferencia y envío gratis, si los tenés).
    </p>
    <Callout tone="aviso">
      <p>
        Si todavía no tenés productos activos, la página te lo avisa arriba: quien entre por el link va a ver la tienda vacía. Publicá al menos
        uno antes de compartir. Lo mismo si la tienda está en modo mantenimiento.
      </p>
    </Callout>

    <h2 id="link">Tu link</h2>
    <p>
      Es la dirección de tu tienda. <strong>Copiar link</strong> lo deja en el portapapeles, <strong>Abrir tienda</strong> la abre en otra
      pestaña y <strong>Compartir por WhatsApp</strong> abre WhatsApp con un mensaje listo para elegir a quién mandarlo. Quien lo abre ve el
      catálogo con precios y stock, y el pedido te llega registrado aunque después lo cierren por WhatsApp.
    </p>

    <h2 id="qr">El código QR</h2>
    <p>
      Al lado del link está el QR de la tienda. <strong>Descargar PNG</strong> te baja una imagen de 1024 px, lista para imprimir. Donde más
      rinde:
    </p>
    <ul>
      <li>Al lado de la caja o en la vidriera: quien pasa puede comprar después.</li>
      <li>En una tarjeta o un sticker dentro de cada bolsa o paquete: la segunda compra suele salir de ahí.</li>
    </ul>

    <h2 id="mensajes">Mensajes listos para pegar</h2>
    <p>
      Tres textos armados con el nombre de tu tienda, el link y tus condiciones. Cada uno tiene su botón para copiar:
    </p>
    <ul>
      <li>
        <strong>Bio de Instagram</strong>: el texto va en la bio y el link, en los enlaces del perfil (el texto de la bio no admite links).
      </li>
      <li>
        <strong>Respuesta por WhatsApp</strong>: para cuando te preguntan el precio. Guardalo como respuesta rápida en WhatsApp Business, por
        ejemplo con el atajo /catalogo.
      </li>
      <li>
        <strong>Historia o estado</strong>: para una historia de Instagram (sumá el sticker de enlace) o un estado de WhatsApp.
      </li>
    </ul>
    <p>
      Si configuraste descuento por transferencia o envío gratis desde un monto, los mensajes los mencionan: es lo que más convence.
    </p>

    <h2 id="producto">Link a un producto o una categoría</h2>
    <p>
      Cuando te preguntan por algo puntual, mandá directo a eso. En <strong>Link para un producto o categoría</strong> buscás por nombre o SKU
      (aparecen primero los últimos productos activos que editaste) o elegís una categoría. Tenés <strong>Copiar link</strong>,{" "}
      <strong>Copiar mensaje</strong> (con el precio) y el QR de ese link, por ejemplo para una góndola o un cartel de temporada.
    </p>

    <h2 id="donde">Dónde poner el link</h2>
    <ul>
      <li>En los enlaces del perfil de Instagram.</li>
      <li>En el mensaje de bienvenida y las respuestas rápidas de WhatsApp Business.</li>
      <li>En la firma del mail y en el perfil de Google de tu negocio.</li>
      <li>En el local y en el packaging, con el QR.</li>
    </ul>
    <p>
      Si antes tenías otra tienda, avisale a tus clientes que te mudaste. Y si traés tu dominio, cargá las direcciones viejas en{" "}
      <strong>Configuración › SEO e integraciones › Redirecciones</strong> para que los links que circulan sigan funcionando.
    </p>
  </>
);
