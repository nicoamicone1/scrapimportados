import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "pasar-la-tienda",
  title: "Pasar la tienda a otra persona",
  description: "Cómo dejar la tienda a nombre de otra persona con todo lo cargado, qué pasa con vos, con el plan y con los cobros, y qué revisar al recibirla.",
  section: "cuenta",
  publishedAt: "2026-10-08",
  updatedAt: "2026-10-08",
  readingMinutes: 2,
  panel: { href: "/admin/usuarios", label: "Usuarios" },
  related: ["planes-prueba-y-equipo", "pedidos-y-cobros"],
};

export const body = (
  <>
    <p>
      A veces la tienda la arma una persona y la sigue otra: la armaste para un cliente, vendiste el negocio o cambia quién lo maneja. No hace
      falta rehacerla. Se la pasás y queda a su nombre con todo lo cargado: productos, fotos, páginas, estilo, pedidos, clientes y cupones.
    </p>

    <h2 id="como">Cómo se pasa</h2>
    <p>
      En <strong>Usuarios</strong>, abajo de todo, tocá <strong>Pasar la tienda</strong>. Escribí el email de quien la recibe y elegí si vos
      seguís como administrador o salís del equipo. Antes de confirmar ves la lista de lo que va a pasar.
    </p>
    <ul>
      <li>
        <strong>Si ya está en el equipo</strong>, la tienda pasa al instante y le avisamos por mail.
      </li>
      <li>
        <strong>Si no está en el equipo</strong> (tenga o no cuenta en Ecommy), le mandamos un mail con un link que vence en 7 días. Con ese
        link entra con su email, o crea su cuenta, y acepta. Hasta que lo acepte, la tienda sigue a tu nombre: podés copiar el link para
        mandárselo por WhatsApp o anularlo.
      </li>
    </ul>
    <p>
      Sólo quien tiene la tienda a su nombre puede pasarla. En Usuarios esa persona figura como «A su nombre», y nadie más le puede cambiar el
      rol, desactivarla ni sacarla del equipo.
    </p>

    <h2 id="que-cambia">Qué cambia y qué no</h2>
    <ArticleTable
      head={["Tema", "Qué pasa"]}
      rows={[
        ["Plan", "Viaja con la tienda. La primera vez que una tienda cambia de dueño, si nunca se pagó un plan, quien la recibe arranca 14 días de Pro gratis."],
        ["Débito automático del plan", "Está a nombre de quien lo paga. Mientras esté vigente no se puede pasar la tienda: cancelá la renovación en Plan y el plan sigue hasta fin del período."],
        ["Cobro con tarjeta (Mercado Pago)", "Se desconecta: la plata de los pedidos tiene que ir a la cuenta del nuevo dueño, que la conecta en Configuración › Pagos."],
        ["CBU o alias, WhatsApp y email de contacto", "No cambian solos. Quien la recibe los tiene que revisar antes de vender."],
        ["Resto del equipo", "Sigue igual. El nuevo dueño decide quién queda."],
        ["Tiendas por cuenta", "Nadie puede tener más de tres a su nombre: si quien la recibe ya tiene tres, no puede aceptarla."],
      ]}
    />

    <h2 id="recibirla">Si te pasan una tienda</h2>
    <p>
      Abrí el link del mail con el mismo email al que te llegó y tocá <strong>Recibir la tienda y entrar al panel</strong>. Lo primero que conviene
      revisar: cómo cobrás, el email de contacto (ahí llegan los avisos de pedidos nuevos) y quién más está en Usuarios.
    </p>
    <Callout>
      <p>
        Pasar la tienda queda registrado en Auditoría. Para volver atrás, la persona que la recibió te la tiene que pasar de nuevo.
      </p>
    </Callout>
  </>
);
