import type { Metadata } from "next";
import Link from "next/link";

import { LegalDoc, type LegalSection } from "@/components/platform/LegalDoc";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { LEGAL_UPDATED_AT } from "@/components/platform/site";
import { getSession } from "@/lib/auth";

import { EmailLink, OwnerStatement } from "../_lib/public-site";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos personales trata Ecommy, para qué, dónde se alojan, cuánto tiempo se guardan y cómo ejercés tus derechos según la Ley 25.326.",
  alternates: { canonical: "/privacidad" },
};
export const dynamic = "force-dynamic";

const AAIP_URL = "https://www.argentina.gob.ar/aaip";

export default async function PrivacidadPage() {
  const { user } = await getSession();

  const sections: LegalSection[] = [
    {
      id: "responsable",
      title: "Quién es el responsable",
      content: (
        <>
          <p>
            Ecommy es responsable de los datos de las <strong>cuentas</strong>: las personas que se registran para crear y administrar
            tiendas. De los datos de los <strong>compradores</strong> de cada tienda, el responsable es el comercio (ver{" "}
            <a href="#compradores">Datos de los compradores de cada tienda</a>).
          </p>
          <OwnerStatement />
        </>
      ),
    },
    {
      id: "datos",
      title: "Qué datos recogemos de tu cuenta",
      content: (
        <ul>
          <li>
            <strong>Datos de registro:</strong> nombre, mail y contraseña. La contraseña se guarda de forma irreversible (hash): nadie en
            Ecommy puede leerla.
          </li>
          <li>
            <strong>Contacto:</strong> el número de WhatsApp que cargás para recibir pedidos y para que te avisemos cosas de tu cuenta.
          </li>
          <li>
            <strong>Datos de la tienda:</strong> nombre, dirección, logo, datos para transferencias (alias o CBU), datos fiscales que decidas
            publicar (razón social, CUIT, Data Fiscal), políticas y el contenido que cargás.
          </li>
          <li>
            <strong>Uso del servicio:</strong> registros técnicos (dirección IP, navegador, fecha y hora), acciones en el panel que quedan en
            el registro de auditoría de la tienda y el estado de tu plan y tus pagos.
          </li>
          <li>
            <strong>Comunicaciones:</strong> lo que nos escribís por mail o WhatsApp.
          </li>
        </ul>
      ),
    },
    {
      id: "finalidad",
      title: "Para qué los usamos",
      content: (
        <>
          <ul>
            <li>Crear y mantener tu cuenta y tus tiendas, y mostrarlas en internet.</li>
            <li>
              Mandarte avisos del servicio: pedidos nuevos, fin de la prueba, cambios de plan, seguridad y cambios en estos textos.
            </li>
            <li>Darte soporte y responder tus consultas.</li>
            <li>Cobrar los planes y cumplir obligaciones legales, fiscales y contables.</li>
            <li>Cuidar la seguridad del servicio y prevenir fraudes o usos indebidos.</li>
            <li>Entender cómo se usa Ecommy, con datos agregados, para mejorarlo.</li>
          </ul>
          <p>
            No vendemos ni alquilamos tus datos, ni los usamos para publicidad de terceros. Si algún día quisiéramos mandarte novedades
            comerciales, te lo vamos a pedir aparte y vas a poder darte de baja en cualquier momento.
          </p>
        </>
      ),
    },
    {
      id: "base-legal",
      title: "Base legal",
      content: (
        <p>
          Tratamos tus datos con tu consentimiento, que das al crear la cuenta (artículo 5 de la Ley 25.326), y porque los necesitamos para
          prestarte el servicio que contrataste y cumplir obligaciones legales. Podés retirar el consentimiento cuando quieras dando de baja la
          cuenta; eso no afecta lo tratado antes.
        </p>
      ),
    },
    {
      id: "compradores",
      title: "Datos de los compradores de cada tienda",
      content: (
        <>
          <p>
            Cuando alguien compra en una tienda hecha con Ecommy, carga sus datos (nombre, mail, teléfono, dirección de entrega y lo que
            compra) para que el <strong>comercio</strong> gestione su pedido. De esa base, el responsable es el comercio: decide para qué la
            usa y responde ante sus clientes.
          </p>
          <p>
            Ecommy actúa por cuenta del comercio, como prestador del servicio de tratamiento (artículo 25 de la Ley 25.326): guarda esos datos
            y los procesa sólo para prestarle el servicio (mostrar el pedido, mandar los mails del pedido, hacer copias de seguridad), no los
            usa para fines propios, no los cede a terceros y los mantiene confidenciales. Cuando el comercio da de baja la tienda, se borran en
            los plazos de <a href="#plazos">Cuánto tiempo los guardamos</a>.
          </p>
          <p>
            Si sos comprador y querés acceder a tus datos, corregirlos o borrarlos, escribile al comercio por los medios de contacto de su
            tienda. Si nos escribís a nosotros, le pasamos tu pedido.
          </p>
        </>
      ),
    },
    {
      id: "proveedores",
      title: "Dónde se alojan y con quién se comparten",
      content: (
        <>
          <p>Para funcionar, Ecommy usa proveedores que tratan datos por cuenta nuestra y con las mismas obligaciones de confidencialidad:</p>
          <ul>
            <li>
              <strong>Supabase:</strong> base de datos, cuentas y archivos (fotos y logos).
            </li>
            <li>
              <strong>Vercel:</strong> alojamiento y publicación del sitio y de las tiendas.
            </li>
            <li>
              <strong>Un proveedor de mail transaccional</strong> para los mails de la cuenta y de los pedidos.
            </li>
          </ul>
          <p>
            Esos servicios pueden guardar datos en servidores fuera de la Argentina (por ejemplo, en Estados Unidos). Al usar Ecommy consentís
            esa transferencia internacional, que hacemos con proveedores que se comprometen a niveles de protección adecuados. Además, cuando
            vos o tus clientes abren WhatsApp desde la tienda, el mensaje sale de su teléfono y queda sujeto a las condiciones de WhatsApp.
          </p>
          <p>Fuera de eso, sólo compartimos datos si lo ordena una autoridad competente o lo exige la ley.</p>
        </>
      ),
    },
    {
      id: "plazos",
      title: "Cuánto tiempo los guardamos",
      content: (
        <ul>
          <li>Mientras tu cuenta esté activa.</li>
          <li>
            Después de la baja, <strong>30 días corridos</strong>, por si nos pedís una copia o querés volver atrás. Pasado ese plazo los
            borramos o los anonimizamos.
          </li>
          <li>
            Lo que la ley nos obliga a conservar (por ejemplo, registros de facturación) lo guardamos el plazo que marque la ley. Las copias de
            seguridad se sobrescriben en su ciclo normal.
          </li>
        </ul>
      ),
    },
    {
      id: "seguridad",
      title: "Seguridad",
      content: (
        <p>
          Todo viaja cifrado (HTTPS), las contraseñas se guardan con hash y cada tienda es accesible sólo para su equipo, según el rol de cada
          persona. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te avisamos sin demoras indebidas y te
          contamos qué hicimos.
        </p>
      ),
    },
    {
      id: "derechos",
      title: "Tus derechos y cómo ejercerlos",
      content: (
        <>
          <p>
            Tenés derecho a <strong>acceder</strong> a tus datos, a <strong>rectificarlos</strong> y actualizarlos, y a pedir que los{" "}
            <strong>suprimamos</strong> (artículos 14 a 16 de la Ley 25.326). Buena parte los cambiás vos desde el panel. Para lo demás,
            escribinos a <EmailLink subject="Datos personales: pedido de acceso, rectificación o supresión" /> desde el mail de tu cuenta.
            Respondemos los pedidos de acceso dentro de los 10 días corridos y los de rectificación o supresión dentro de los 5 días hábiles.
          </p>
          <p>
            El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no
            inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de
            la Ley N° 25.326.
          </p>
          <p>
            La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de
            atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas
            vigentes en materia de protección de datos personales. Más información en <a href={AAIP_URL}>argentina.gob.ar/aaip</a>.
          </p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "Cookies y almacenamiento en el navegador",
      content: (
        <>
          <p>Ecommy usa sólo lo estrictamente necesario para funcionar:</p>
          <ul>
            <li>
              <strong>Sesión:</strong> cookies que te mantienen conectado a tu cuenta.
            </li>
            <li>
              <strong>Panel:</strong> una cookie con la tienda que estás administrando y otras de preferencias (por ejemplo, si el menú está
              plegado).
            </li>
            <li>
              <strong>Carrito:</strong> en las tiendas, el carrito y el cupón se guardan en el almacenamiento local del navegador del
              comprador (localStorage), no en una cookie, para que no se pierdan al volver.
            </li>
          </ul>
          <p>
            El sitio de Ecommy no usa cookies de publicidad ni de analítica de terceros. En cada tienda, la analítica (Google Analytics, Tag
            Manager o Meta Pixel) se activa sólo si el comercio la configura; en ese caso el comercio es responsable de informarlo a sus
            clientes.
          </p>
        </>
      ),
    },
    {
      id: "menores",
      title: "Menores de edad",
      content: (
        <p>
          Las cuentas de Ecommy son para mayores de 18 años. No recogemos a sabiendas datos de menores para crear cuentas; si detectamos
          alguno, lo borramos.
        </p>
      ),
    },
    {
      id: "cambios",
      title: "Cambios en esta política",
      content: (
        <p>
          Si cambiamos esta política, actualizamos la fecha de arriba. Si el cambio es importante, te avisamos por mail antes de que rija.
        </p>
      ),
    },
    {
      id: "contacto",
      title: "Contacto",
      content: (
        <p>
          Por cualquier consulta sobre tus datos, escribinos a <EmailLink subject="Consulta sobre privacidad" /> o entrá a{" "}
          <Link href="/contacto">Contacto</Link>. Las condiciones de uso del servicio están en los{" "}
          <Link href="/terminos">términos del servicio</Link>.
        </p>
      ),
    },
  ];

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <LegalDoc
        title="Política de privacidad"
        updatedAt={LEGAL_UPDATED_AT}
        intro={
          <>
            <p>
              Esta política explica qué datos personales trata Ecommy, para qué, dónde se guardan y cómo ejercés tus derechos, según la Ley
              25.326 de Protección de los Datos Personales.
            </p>
            <p>Resumen: tus datos y los de tus clientes no se venden ni se usan para publicidad, y te los podés llevar cuando quieras.</p>
          </>
        }
        sections={sections}
      />
    </PlatformPage>
  );
}

/*
 * PARA EL DUEÑO (no se muestra en la página):
 * - Borrador de buena fe, no asesoramiento legal: hacelo revisar por un
 *   abogado antes de lanzar (transferencia internacional, plazos de
 *   conservación, rol de encargado frente a los datos de los compradores).
 * - Completá PLATFORM_OWNER en src/components/platform/site.ts. Mientras
 *   esté en null, el punto 1 dice que los datos del titular se informan a
 *   pedido por mail.
 * - Evaluá con el abogado inscribir la base de datos de cuentas en el
 *   Registro Nacional de Bases de Datos de la AAIP.
 * - Si sumás analítica al sitio de Ecommy o cambiás de proveedores
 *   (Supabase, Vercel, mail transaccional), actualizá los puntos
 *   "Cookies" y "Dónde se alojan", y LEGAL_UPDATED_AT.
 */
