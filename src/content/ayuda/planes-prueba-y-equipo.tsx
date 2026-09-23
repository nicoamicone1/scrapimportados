import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "planes-prueba-y-equipo",
  title: "Planes, prueba de 14 días y equipo",
  description: "Qué incluye cada plan, qué pasa cuando termina la prueba gratis, cómo pedir un cambio de plan y cómo sumar a tu equipo con roles.",
  section: "cuenta",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/plan", label: "Plan" },
  related: ["primeros-pasos", "lo-que-exige-la-ley"],
};

export const body = (
  <>
    <p>
      Cada tienda tiene su plan: Free, Starter, Pro o Business. Ninguno cobra comisión por venta. Los precios vigentes están en{" "}
      <Link href="/planes">Planes</Link>; acá va qué cambia entre uno y otro y cómo se maneja desde el panel.
    </p>

    <h2 id="planes">Qué suma cada plan</h2>
    <ArticleTable
      head={["Plan", "Lo que agrega"]}
      rows={[
        ["Free", "La tienda completa: catálogo con variantes, zonas de envío por mapa, remitos, checkout por WhatsApp, cupones y todo lo legal. Dos estilos (Nórdico y Mercado) y la portada."],
        ["Starter", "Importar y actualizar desde planilla, los 10 estilos, páginas extra, promociones programadas, Google Analytics, Tag Manager y Meta Pixel, y equipo."],
        ["Pro", "Importar desde otra web, precios masivos con deshacer, dominio propio, registro de auditoría, exportar a CSV, CSS personalizado y productos sin tope."],
        ["Business", "A medida: más tiendas, catálogos grandes o una mudanza asistida."],
      ]}
    />
    <p>
      Los límites (productos, páginas, usuarios, fotos por producto, importaciones por mes) están en la tabla de{" "}
      <Link href="/planes">Planes</Link>. En el panel, <strong>Plan</strong> muestra en <strong>Uso</strong> cuánto usa hoy tu tienda de cada uno.
    </p>

    <h2 id="prueba">La prueba de 14 días</h2>
    <p>
      Toda tienda nueva arranca con 14 días de Pro, sin tarjeta y sin datos de pago. Mientras dura, el chip del menú lateral dice, por ejemplo,
      «Prueba Pro · 9 días», y una franja arriba del panel te recuerda cuánto falta.
    </p>
    <p>
      Si al terminar no elegiste un plan pago, la tienda pasa a Free. <strong>No se borra nada</strong>: productos, pedidos, páginas y fotos
      quedan donde están. Lo que excede Free queda bloqueado para crear hasta que subas de plan; por ejemplo, si tenés más productos que el tope
      de Free, podés seguir vendiendo los que están, pero no cargar nuevos.
    </p>
    <Callout>
      <p>
        Aprovechá la prueba para lo que después es pago: importar tu catálogo desde tu web anterior o aplicar un aumento masivo. Lo que
        importaste se queda aunque pases a Free.
      </p>
    </Callout>

    <h2 id="cambiar">Cambiar de plan</h2>
    <p>
      En <strong>Plan › Cambiar de plan</strong> comparás los planes y tocás <strong>Quiero Starter</strong> o <strong>Quiero Pro</strong>. Se
      abre WhatsApp con el pedido armado y lo activamos en el día. Para Business, <strong>Hablemos</strong>. Por ahora el cobro del plan se
      coordina con nosotros; el cobro automático llega en una próxima versión.
    </p>

    <h2 id="equipo">Sumar a tu equipo</h2>
    <p>
      En <strong>Usuarios</strong>, el dueño toca <strong>Invitar</strong>, escribe el email y elige el rol. Si esa persona ya tiene cuenta, entra
      directo al equipo. Si no, te damos un link de invitación que vence en 7 días para que se lo mandes: al abrirlo se registra con ese email y
      queda adentro. Las invitaciones sin usar aparecen en <strong>Invitaciones pendientes</strong>, donde podés copiarlas de nuevo o anularlas.
    </p>
    <ArticleTable
      head={["Rol", "Qué puede hacer"]}
      rows={[
        ["Dueño", "Todo, incluido el equipo. Puede haber más de un dueño."],
        ["Administrador", "Todo menos invitar gente y cambiar roles."],
        ["Staff", "El día a día: pedidos, productos, stock y contenido. No entra a Configuración, Usuarios ni Auditoría ni cambia precios en masa."],
      ]}
    />
    <p>
      Desde el menú de cada persona podés <strong>Cambiar rol</strong>, <strong>Desactivar</strong> (no entra más hasta que la reactives) o{" "}
      <strong>Quitar del equipo</strong>. Lo que hizo queda registrado; en Pro, <strong>Auditoría</strong> muestra quién cambió qué y cuándo.
      Sumar personas está desde Starter, y cada plan tiene un tope de usuarios.
    </p>

    <h2 id="tiendas">Más de una tienda</h2>
    <p>
      Una cuenta puede tener hasta tres tiendas propias, cada una con su plan, su dirección y su equipo. Las creás desde{" "}
      <strong>Mis tiendas › Crear tienda</strong> y cambiás de una a otra con el selector de tienda de la barra de arriba del panel.
    </p>
  </>
);
