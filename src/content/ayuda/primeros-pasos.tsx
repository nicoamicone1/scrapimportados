import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";
import { exampleStoreAddress } from "@/components/platform/site";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "primeros-pasos",
  title: "Crear tu tienda y dejarla lista en una tarde",
  description: "Del registro a la tienda lista para compartir: los tres pasos del alta y las seis tareas de «Primeros pasos» del Dashboard, en un orden que funciona.",
  section: "empezar",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin", label: "el Dashboard" },
  related: ["cargar-un-producto", "pedidos-y-cobros", "compartir-tu-tienda"],
};

export const body = (
  <>
    <p>
      Con el nombre de tu tienda, un WhatsApp y un puñado de productos con foto, en una tarde dejás la tienda lista para compartir. Esta es la
      secuencia que sigue el panel, con los nombres de cada campo.
    </p>

    <h2 id="antes">Qué tener a mano</h2>
    <ul>
      <li>
        El <strong>nombre</strong> de la tienda y cómo querés que quede su dirección, por ejemplo {exampleStoreAddress("taller-luna")}.
      </li>
      <li>
        El <strong>WhatsApp</strong> donde querés recibir los pedidos, con código de país y área y sin espacios: 5493816173548.
      </li>
      <li>
        El <strong>alias o CBU</strong> para las transferencias y el descuento que vas a ofrecer por pagar así.
      </li>
      <li>
        Tus primeros productos con foto, precio y stock. Si ya están en una planilla o en otra tienda online, los importás en vez de cargarlos
        uno por uno.
      </li>
    </ul>

    <h2 id="alta">El alta en tres pasos</h2>
    <p>
      Primero creás tu cuenta en <Link href="/registro">Crear cuenta</Link> con tu nombre, tu email y una contraseña de al menos 8 caracteres.
      Si te pedimos confirmar el email, el link del correo te lleva directo a crear la tienda.
    </p>
    <ol>
      <li>
        <strong>Tu tienda.</strong> Escribís el <strong>Nombre de la tienda</strong> y la <strong>Dirección</strong> se completa sola: te avisamos
        en el momento si está disponible. Elegís el <strong>Rubro</strong>, que define el estilo con el que arranca la tienda (lo cambiás cuando
        quieras).
      </li>
      <li>
        <strong>Contacto.</strong> El <strong>WhatsApp de la tienda</strong>, la ciudad, la provincia y la <strong>Moneda de los precios</strong>:
        pesos o dólares, una sola por tienda.
      </li>
      <li>
        <strong>Cobros.</strong> Marcás <strong>Transferencia bancaria</strong> (descuento, alias, CBU o CVU y titular), <strong>Acordar por
        WhatsApp</strong> o las dos. Si no tenés los datos a mano, los completás después en <strong>Configuración › Pagos y checkout</strong>.
      </li>
    </ol>
    <p>
      Con <strong>Crear mi tienda</strong> entrás al panel. La tienda arranca con 14 días del plan Pro gratis, sin tarjeta.
    </p>

    <h2 id="checklist">La lista «Primeros pasos» del Dashboard</h2>
    <p>
      Arriba del <strong>Dashboard</strong> aparece la tarjeta <strong>Dejá lista tu tienda</strong> con seis tareas. Cada una se tilda sola
      cuando la hacés; no hay que marcar nada a mano.
    </p>
    <ArticleTable
      head={["Tarea", "Dónde se hace", "Se tilda cuando…"]}
      rows={[
        ["Cargá tu primer producto", "Productos › Nuevo producto", "hay al menos un producto que no está archivado"],
        ["Personalizá la apariencia", "Apariencia", "guardás el tema"],
        ["Configurá los envíos", "Envíos", "hay una zona o un punto de retiro activos"],
        ["Definí cómo cobrás", "Configuración › Pagos y checkout", "cargaste CBU o alias, o el WhatsApp está activo con número"],
        ["Ajustá tu página de inicio", "Páginas", "publicás la portada después de editarla"],
        ["Compartí el link de tu tienda", "Compartir", "copiás el link o lo mandás por WhatsApp"],
      ]}
    />
    <p>
      Cuando ya no la necesites, <strong>Ocultar</strong> la saca del Dashboard.
    </p>

    <h2 id="orden">Un orden que funciona</h2>
    <ol>
      <li>
        <strong>Cobros.</strong> Revisá el alias y el descuento por transferencia: es lo primero que el cliente necesita para pagarte.
      </li>
      <li>
        <strong>Productos.</strong> Cargá cinco o diez a mano para conocer el formulario, o{" "}
        <Link href="/ayuda/importar-csv">importá el catálogo desde una planilla</Link>.
      </li>
      <li>
        <strong>Envíos.</strong> Alcanza con una zona «Todo el país» con costo fijo y, si tenés local, el retiro sin cargo.
      </li>
      <li>
        <strong>Apariencia.</strong> Subí el logo en <strong>Marca y anuncio</strong>, ajustá dos o tres colores y guardá.
      </li>
      <li>
        <strong>Portada.</strong> Cambiá el título de la portada por algo concreto: qué vendés y por qué comprarte ahora.
      </li>
      <li>
        <strong>Legales.</strong> En <strong>Configuración › Impuestos y legales</strong> cargá tu CUIT, insertá las plantillas de políticas y
        revisalas.
      </li>
      <li>
        <strong>Pedido de prueba.</strong> Abrí la tienda con <strong>Ver tienda</strong>, comprá algo como si fueras cliente y mirá cómo te
        llega en <strong>Pedidos</strong>. Después cancelalo desde el detalle, en <strong>Más acciones › Cancelar pedido</strong>: si había
        descontado stock, vuelve solo.
      </li>
      <li>
        <strong>Compartir.</strong> Copiá el link desde <strong>Compartir</strong> y ponelo en tu Instagram y en tu WhatsApp Business.
      </li>
    </ol>

    <Callout>
      <p>
        Durante la prueba tenés todas las funciones de Pro. Si al terminar no elegís un plan, la tienda pasa a Free y no se borra nada. Más en{" "}
        <Link href="/ayuda/planes-prueba-y-equipo">Planes, prueba de 14 días y equipo</Link>.
      </p>
    </Callout>
  </>
);
