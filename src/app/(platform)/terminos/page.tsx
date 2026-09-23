import type { Metadata } from "next";
import Link from "next/link";

import { LegalDoc, type LegalSection } from "@/components/platform/LegalDoc";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { availability } from "@/components/platform/plan-notes";
import { LEGAL_UPDATED_AT } from "@/components/platform/site";
import { getSession } from "@/lib/auth";

import { EmailLink, OwnerStatement, plansOrEmpty } from "../_lib/public-site";

export const metadata: Metadata = {
  title: "Términos del servicio",
  description:
    "Condiciones de uso de Ecommy: cuentas y tiendas, planes y prueba de 14 días, qué le toca al comercio y qué a Ecommy, tus datos, baja y ley aplicable.",
  alternates: { canonical: "/terminos" },
};
export const dynamic = "force-dynamic";

export default async function TerminosPage() {
  const [{ user }, plans] = await Promise.all([getSession(), plansOrEmpty("terminos")]);
  const exportFrom = availability(plans, "orders.export");

  const sections: LegalSection[] = [
    {
      id: "servicio",
      title: "Qué es Ecommy",
      content: (
        <>
          <p>
            Ecommy es un software como servicio para crear y administrar tiendas online: te damos la tienda con tu marca y un panel para
            manejar catálogo, stock, pedidos, envíos, páginas y equipo.
          </p>
          <p>
            Ecommy <strong>no vende los productos de tu tienda, no es parte de la compraventa y no cobra ni recibe el dinero de tus ventas</strong>
            . No hay pasarela de pago: tus clientes te pagan a vos, por transferencia o como lo acuerden por WhatsApp. La compraventa es entre
            vos y tu cliente.
          </p>
        </>
      ),
    },
    {
      id: "titular",
      title: "Quién presta el servicio",
      content: <OwnerStatement />,
    },
    {
      id: "cuenta",
      title: "Tu cuenta y tus tiendas",
      content: (
        <ul>
          <li>
            Para usar Ecommy creás una cuenta con tu mail y una contraseña. Tenés que ser mayor de 18 años y, si la abrís en nombre de una
            empresa, tener facultades para representarla.
          </li>
          <li>
            Los datos que cargás tienen que ser reales y estar al día, sobre todo el mail y el WhatsApp: por ahí te avisamos cosas de tu cuenta.
          </li>
          <li>
            Sos responsable de lo que se haga con tu cuenta. Cuidá tu contraseña y avisanos enseguida si creés que alguien entró sin permiso.
          </li>
          <li>Cada cuenta puede tener hasta 3 tiendas propias. Cada tienda tiene su plan, su dirección y su equipo.</li>
          <li>
            Si sumás personas al equipo de una tienda, lo que hagan ahí corre por cuenta del titular de la tienda. En los planes que incluyen
            el registro de auditoría ves quién hizo cada cambio.
          </li>
        </ul>
      ),
    },
    {
      id: "planes",
      title: "Planes, prueba y pagos",
      content: (
        <ul>
          <li>
            Los planes, lo que incluye cada uno y sus precios están en <Link href="/planes">Planes</Link>. Los precios son finales, en pesos
            argentinos, por mes y por tienda.
          </li>
          <li>
            Toda tienda nueva arranca con <strong>14 días del plan Pro gratis</strong>, sin tarjeta. Si al terminar no elegiste un plan pago,
            la tienda pasa a Free. No se borra nada: lo que excede lo que permite Free queda guardado, pero no podés crear más hasta que subas
            de plan.
          </li>
          <li>
            Hoy el cambio de plan y el cobro se coordinan con nosotros: lo pedís desde el panel (en Plan) o por WhatsApp, te pasamos los datos
            para pagar y activamos el plan cuando se acredita. Cuando sumemos el cobro automático con MercadoPago, te lo vamos a avisar antes
            de usarlo.
          </li>
          <li>
            Los planes pagos se pagan por mes adelantado. Si un pago no se acredita, te avisamos y tenés al menos 10 días corridos para
            regularizarlo; si no, la tienda pasa a Free. Tus datos no se borran por eso.
          </li>
          <li>
            Si bajás de plan, el cambio rige desde el período siguiente y no hay reintegro por el mes en curso, salvo el arrepentimiento del punto siguiente.
          </li>
          <li>
            Si sos consumidor en los términos de la Ley 24.240, podés revocar la contratación de un plan pago dentro de los 10 días corridos
            desde que lo contrataste, escribiéndonos a <EmailLink subject="Arrepentimiento de plan" />, sin costo ni explicación. Te
            devolvemos lo que pagaste.
          </li>
          <li>
            Podemos cambiar los precios o lo que incluye cada plan. Si el cambio te afecta, te avisamos por mail con al menos 30 días de
            anticipación y rige desde el período siguiente. Si no estás de acuerdo, podés cambiar de plan o dar de baja la tienda antes.
          </li>
        </ul>
      ),
    },
    {
      id: "comercio",
      title: "Lo que te toca a vos",
      content: (
        <>
          <p>Vos sos el vendedor. En particular, sos responsable de:</p>
          <ul>
            <li>
              Los productos que publicás, sus fotos, descripciones, precios, stock y promociones, y de cumplir lo que ofrecés: entregas,
              cambios, garantías y devoluciones.
            </li>
            <li>
              Cumplir las normas fiscales y de defensa del consumidor que apliquen a tu actividad: facturar tus ventas, publicar el formulario
              Data Fiscal de ARCA, mostrar el precio sin impuestos nacionales (Régimen de Transparencia Fiscal al Consumidor) y atender el
              botón de arrepentimiento (Resolución 424/2020). La tienda trae esas herramientas; cargarlas, mantenerlas al día y cumplir lo que
              informan es tu responsabilidad.
            </li>
            <li>Tener los derechos sobre lo que subís: fotos, textos, marcas y logos. No uses material de otros sin permiso.</li>
            <li>
              Los datos de tus clientes: los usás para gestionar sus pedidos y para lo que ellos acepten, y cumplís la Ley 25.326 como
              responsable de esa base (más detalle en la <Link href="/privacidad#compradores">política de privacidad</Link>).
            </li>
            <li>
              Los servicios de terceros que conectes a tu tienda (por ejemplo, Google Analytics, Meta Pixel o tu dominio) y sus condiciones.
            </li>
            <li>Verificar los pagos que recibís: Ecommy no controla comprobantes ni garantiza que una transferencia se acredite.</li>
          </ul>
        </>
      ),
    },
    {
      id: "ecommy",
      title: "Lo que nos toca a nosotros",
      content: (
        <ul>
          <li>
            Mantener el servicio funcionando de forma razonable. Puede haber cortes por mantenimiento, fallas o problemas de nuestros
            proveedores; los programados los avisamos antes. En Free y Starter no hay un nivel de disponibilidad garantizado (SLA); si tu
            negocio lo necesita, lo acordamos en Business.
          </li>
          <li>
            Cuidar la seguridad: conexión cifrada, contraseñas guardadas de forma irreversible (hash) y acceso a cada tienda sólo para su
            equipo, según el rol de cada persona.
          </li>
          <li>
            Hacer copias de seguridad periódicas de la base de datos. No reemplazan las tuyas: te recomendamos exportar tus datos cada tanto.
          </li>
          <li>Darte soporte por mail y WhatsApp en horario hábil, de lunes a viernes.</li>
          <li>Avisarte con anticipación los cambios del servicio que te afecten.</li>
        </ul>
      ),
    },
    {
      id: "uso",
      title: "Uso aceptable",
      content: (
        <>
          <p>No podés usar Ecommy para:</p>
          <ul>
            <li>
              Vender productos o servicios ilegales, o cuya venta online esté prohibida o requiera una habilitación que no tenés: por ejemplo,
              armas y municiones, medicamentos de venta bajo receta, estupefacientes, fauna silvestre, productos robados o falsificados.
            </li>
            <li>Engañar a los compradores: productos que no tenés, precios que no respetás, cobros por pedidos que no vas a entregar.</li>
            <li>Mandar mensajes no pedidos (spam) o usar los datos de la plataforma para eso.</li>
            <li>Publicar contenido que infrinja derechos de terceros, que sea discriminatorio o violento, o que incite a cometer delitos.</li>
            <li>
              Copiar el catálogo de otro comercio: la importación desde otra web es para traer el tuyo, desde una tienda que administres o con
              permiso de su dueño.
            </li>
            <li>
              Intentar entrar a tiendas o datos de otros, vulnerar la seguridad, automatizar pedidos o consultas masivas o sobrecargar el
              servicio.
            </li>
            <li>Revender o sublicenciar el servicio sin un acuerdo con nosotros.</li>
          </ul>
        </>
      ),
    },
    {
      id: "datos",
      title: "Tus datos y tu contenido",
      content: (
        <ul>
          <li>
            Tus datos son tuyos: productos, fotos, textos, pedidos y clientes. No los vendemos ni los usamos para otra cosa que prestarte el
            servicio.
          </li>
          <li>
            Nos das una licencia limitada, no exclusiva y gratuita para alojar, copiar, mostrar y procesar ese contenido sólo en la medida
            necesaria para operar el servicio: mostrar tu tienda, generar miniaturas de las fotos, mandar los mails de los pedidos y hacer
            copias de seguridad. Termina cuando borrás el contenido o la tienda.
          </li>
          <li>
            Podés llevarte tus datos cuando quieras. En los planes que incluyen la exportación ({exportFrom}), bajás productos, inventario,
            pedidos y clientes en CSV desde el panel. En cualquier plan, si nos lo pedís por mail, te mandamos una copia en CSV.
          </li>
          <li>El tratamiento de datos personales se rige por la <Link href="/privacidad">política de privacidad</Link>.</li>
        </ul>
      ),
    },
    {
      id: "baja",
      title: "Suspensión y baja",
      content: (
        <ul>
          <li>
            Podés dar de baja una tienda o tu cuenta cuando quieras, escribiéndonos a <EmailLink subject="Baja de cuenta" /> desde el mail de
            la cuenta. No hay permanencia mínima.
          </li>
          <li>
            Podemos suspender una tienda (dejarla fuera de línea) o la cuenta si hay un pago vencido después del plazo de <a href="#planes">Planes, prueba y pagos</a>, si se usa
            en contra de estos términos o de la ley, o si lo ordena una autoridad competente. Salvo urgencia (un riesgo para terceros o para
            el servicio, o una orden judicial), te avisamos antes y te damos la oportunidad de corregirlo.
          </li>
          <li>
            Después de la baja conservamos tus datos durante <strong>30 días corridos</strong>, para que puedas pedir una copia o volver atrás.
            Pasado ese plazo los borramos, salvo lo que la ley nos obligue a conservar (por ejemplo, registros de facturación). Las copias de
            seguridad se sobrescriben en su ciclo normal.
          </li>
        </ul>
      ),
    },
    {
      id: "responsabilidad",
      title: "Límite de responsabilidad",
      content: (
        <ul>
          <li>
            Hacemos lo razonable para que Ecommy funcione bien, pero no garantizamos que esté libre de errores ni que sirva para un fin
            particular de tu negocio.
          </li>
          <li>
            No respondemos por la relación con tus clientes (productos, entregas, pagos y reclamos), por fallas de servicios de terceros que no
            controlamos (bancos, billeteras, WhatsApp, proveedores de internet), por ventas u oportunidades perdidas, ni por lo que resulte de
            datos incorrectos que cargues o de un acceso a tu cuenta por no cuidar tu contraseña.
          </li>
          <li>
            En la medida en que la ley lo permita, nuestra responsabilidad total frente a vos se limita a lo que hayas pagado por el servicio en
            los 12 meses anteriores al hecho que origina el reclamo.
          </li>
          <li>
            Si un tercero nos reclama por algo que es tu responsabilidad según <a href="#comercio">Lo que te toca a vos</a>, te hacés cargo de ese reclamo y nos mantenés
            indemnes.
          </li>
          <li>
            Nada de esto limita la responsabilidad que la ley no permite limitar, en particular por dolo o culpa grave, ni tus derechos como
            consumidor si la Ley 24.240 te alcanza.
          </li>
        </ul>
      ),
    },
    {
      id: "cambios",
      title: "Cambios en estos términos",
      content: (
        <p>
          Podemos actualizar estos términos. Los cambios importantes te los avisamos por mail con al menos 30 días de anticipación, y la fecha
          de arriba cambia. Si seguís usando Ecommy después de que rijan, se entiende que los aceptás; si no estás de acuerdo, podés dar de baja
          la cuenta antes y llevarte tus datos.
        </p>
      ),
    },
    {
      id: "ley",
      title: "Ley aplicable y jurisdicción",
      content: (
        <p>
          Estos términos se rigen por las leyes de la República Argentina. Cualquier conflicto se somete a los tribunales ordinarios
          competentes de la República Argentina, sin perjuicio de las normas de orden público que te permitan reclamar en tu domicilio (por
          ejemplo, si sos consumidor). Antes de llegar a eso, escribinos: casi todo se resuelve por mail.
        </p>
      ),
    },
    {
      id: "contacto",
      title: "Contacto",
      content: (
        <p>
          Por cualquier consulta sobre estos términos, escribinos a <EmailLink subject="Consulta sobre los términos" /> o entrá a{" "}
          <Link href="/contacto">Contacto</Link>.
        </p>
      ),
    },
  ];

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <LegalDoc
        title="Términos del servicio"
        updatedAt={LEGAL_UPDATED_AT}
        intro={
          <>
            <p>
              Estos términos regulan el uso de Ecommy. Al crear una cuenta los aceptás, junto con la{" "}
              <Link href="/privacidad" className="text-adm-accent underline underline-offset-2">
                política de privacidad
              </Link>
              .
            </p>
            <p>Están escritos para que se entiendan sin abogado. Si algo no te queda claro, preguntanos antes de aceptar.</p>
          </>
        }
        sections={sections}
      />
    </PlatformPage>
  );
}

/*
 * PARA EL DUEÑO (no se muestra en la página):
 * - Este texto es un borrador de buena fe, no asesoramiento legal. Hacelo
 *   revisar por un abogado antes de lanzar: sobre todo el límite de
 *   responsabilidad, el plazo de gracia por impago (10 días), el
 *   arrepentimiento (Ley 24.240) y la jurisdicción (si querés fijar los
 *   tribunales de tu ciudad, cambiá el punto "Ley aplicable y jurisdicción").
 * - Completá PLATFORM_OWNER en src/components/platform/site.ts (nombre o
 *   razón social, CUIT, domicilio). Mientras esté en null, el punto 2 dice
 *   que esos datos se informan a pedido por mail.
 * - Si cambiás el texto, actualizá LEGAL_UPDATED_AT (mismo archivo) y avisá
 *   por mail a las cuentas si el cambio es importante (punto "Cambios").
 */
