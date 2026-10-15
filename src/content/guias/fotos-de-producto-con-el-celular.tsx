import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { GuideMeta } from "../types";

/*
 * Lo que se dice de cómo trata Ecommy las fotos sale del código:
 * `src/components/admin/products/image-upload.ts` (máx. 1600 px por lado,
 * WebP, formatos aceptados: JPG, PNG, WebP, GIF, AVIF, SVG; no HEIC) y
 * `--card-ratio` / `--card-fit` en `src/lib/theme/css.ts` (proporción por
 * estilo; 4:5 y 3:4 recortan, 1:1 y 16:9 muestran la foto entera).
 */

export const meta: GuideMeta = {
  slug: "fotos-de-producto-con-el-celular",
  title: "Fotos de producto con el celular para tu tienda de ropa (sin estudio)",
  description: "Luz de ventana, fondo liso, prenda planchada y siempre la misma distancia: cómo sacar fotos de ropa para vender con el celular, cuántas y en qué orden.",
  section: "Fotos",
  publishedAt: "2026-10-15",
  updatedAt: "2026-10-15",
  readingMinutes: 7,
  cta: {
    title: "Cargá tus prendas con esas fotos y compartí el link",
    text: "En Ecommy subís las fotos desde el celular, cada talle y color tiene su stock, y el pedido te llega armado por WhatsApp. Probalo 14 días con Pro, sin tarjeta.",
  },
};

export const body = (
  <>
    <p>
      En una tienda de ropa la foto hace el trabajo que en el local hace el probador: muestra cómo cae la tela, de qué color es de verdad y cómo
      queda puesta. La buena noticia es que no hace falta un estudio. Con el celular que ya tenés, una ventana y una tarde ordenada se sacan
      fotos que venden. Lo que sigue es el método, en el orden en que conviene hacerlo.
    </p>

    <h2 id="luz">La luz: una ventana y la hora correcta</h2>
    <p>
      La luz importa más que el celular. Buscá una ventana grande donde no entre el sol directo: la luz que rebota en el cielo es pareja y no
      marca sombras duras. Si el sol pega en el vidrio, colgá una cortina blanca fina o papel manteca y usala como difusor.
    </p>
    <ul>
      <li>
        <strong>Apagá las luces de la casa.</strong> La lamparita amarilla mezclada con la luz de la ventana tiñe la prenda y el color deja de
        ser el real.
      </li>
      <li>
        <strong>Poné la prenda de costado a la ventana</strong>, no de frente ni de espaldas. Del lado opuesto, una cartulina blanca o un
        telgopor rebota luz y aclara las sombras.
      </li>
      <li>
        <strong>Elegí una franja horaria y respetala.</strong> A media mañana y a media tarde la luz suele ser más pareja. Sacá todas las fotos
        de una tanda a la misma hora.
      </li>
    </ul>

    <h2 id="fondo-y-prenda">Fondo neutro y prenda lista</h2>
    <p>
      El fondo tiene que desaparecer. Una pared lisa clara, una cartulina grande blanca o gris claro, o una sábana bien estirada. Nada de
      estampados, muebles ni el placard abierto atrás.
    </p>
    <p>
      La prenda, planchada o vaporizada, sin pelusas (un rollo quitapelusas o cinta de embalar alcanza) y con las etiquetas escondidas. Si
      la mostrás en percha o en maniquí, ajustá la caída con broches por detrás, donde no se vean. Una arruga en la foto se lee como «usada».
    </p>

    <h2 id="tomas">Las tomas: qué foto muestra qué</h2>
    <p>
      Hay dos formas de mostrar una prenda y conviene combinarlas. <strong>Apoyada sobre el fondo</strong>, fotografiada desde arriba con el
      celular paralelo al piso, muestra la forma y el color sin distracciones. <strong>Puesta</strong>, sobre una persona, muestra el calce y
      el largo, que es lo que más preguntan. Con cinco fotos por producto cubrís casi todas las dudas; si tenés menos lugar, priorizá frente,
      puesta y detalle de tela:
    </p>
    <ArticleTable
      head={["Foto", "Qué responde", "Cómo"]}
      rows={[
        ["Frente", "Cómo es la prenda.", "Apoyada o en percha, centrada, entera. Es la foto principal, la que se ve en el listado."],
        ["Espalda", "Si tiene algo atrás: espalda abierta, bolsillos, costuras.", "Misma distancia y encuadre que el frente."],
        ["Detalle de tela", "Textura, trama, grosor, brillo.", "Bien cerca, con luz de costado para que se note la textura."],
        ["Puesta", "Cómo calza y hasta dónde llega.", "De cuerpo entero o de los hombros a las rodillas, con la cámara a la altura del pecho."],
        ["Detalle de terminación", "Botones, cierres, etiqueta, bolsillos.", "Una sola foto, del detalle que más te preguntan."],
      ]}
    />
    <p>
      En la foto puesta, sumá en la descripción la altura de quien la lleva y el talle que usa: «Ella mide 1,65 m y lleva talle M» ahorra
      mensajes de «¿cómo me quedaría?». Si la prenda viene en varios colores, sacá al menos el frente de cada uno con la misma luz, así la
      clienta ve la diferencia real entre el beige y el crudo.
    </p>

    <h2 id="encuadre">Encuadre: vertical, con aire alrededor</h2>
    <p>
      La ropa es vertical, y la mayoría de la gente va a ver tu tienda en el celular. Sacá en vertical y dejá aire alrededor de la prenda:
      después vas a poder usar la misma foto en una proporción cuadrada o en una más alta sin cortar mangas ni ruedo.
    </p>
    <ul>
      <li>
        <strong>Usá la lente principal (1x)</strong>, la que viene por defecto. El gran angular de muy cerca deforma, y el zoom digital pierde
        detalle. Si necesitás la prenda más grande, acercate vos.
      </li>
      <li>
        <strong>Activá la cuadrícula</strong> en los ajustes de la cámara y centrá la prenda: así todas quedan alineadas en el listado.
      </li>
      <li>
        <strong>Fijá el foco y la exposición</strong>: en la mayoría de los celulares se hace manteniendo el dedo apretado sobre la prenda
        en la pantalla. Así no cambia el brillo de una foto a la otra.
      </li>
    </ul>
    <p>
      Muchas tiendas muestran todas las fotos con la misma proporción, la que define el estilo: cuadrada, 4:5 o 3:4. En las verticales la
      foto se recorta para llenar el cuadro; en la cuadrada se ve entera, con margen. Si ya elegiste el estilo de tu tienda, sacá pensando en
      esa proporción (en <Link href="/ayuda/estilo-colores-tipografias">esta ayuda</Link> está dónde se cambia).
    </p>

    <h2 id="consistencia">Que todas parezcan de la misma tienda</h2>
    <p>
      Una tienda se ve profesional cuando las fotos se parecen entre sí, más que cuando cada foto es espectacular. Para lograrlo, repetí
      siempre lo mismo:
    </p>
    <ol>
      <li>La misma ventana, a la misma hora.</li>
      <li>El mismo fondo, en el mismo lugar.</li>
      <li>La misma distancia: marcá con cinta en el piso dónde va el trípode o dónde te parás vos.</li>
      <li>El mismo orden de tomas para cada producto: frente, espalda, detalle, puesta, terminación.</li>
      <li>La misma edición para toda la tanda.</li>
    </ol>
    <p>
      Para editar alcanza con el editor que trae el celular o una app gratuita como Snapseed. Ajustá brillo, recorte y enderezado, y aplicá
      los mismos valores a toda la tanda. Nada de filtros que cambien el color: si la remera llega de otro tono que en la foto, es un cambio o
      una devolución.
    </p>
    <Callout tone="aviso">
      <p>
        Mirá cada foto al lado de la prenda real antes de subirla. El blanco tiene que ser blanco y el verde tiene que ser ese verde. Si no
        coinciden, corregí la luz, no el filtro.
      </p>
    </Callout>

    <h2 id="archivos">Nombres, formato y peso</h2>
    <p>
      Antes de subir, renombrá los archivos con el producto, el color y la toma: <code>remera-lino-blanca-frente.jpg</code>,{" "}
      <code>remera-lino-blanca-espalda.jpg</code>. Encontrás todo más rápido, no mezclás colores y, si después cargás el catálogo desde una
      planilla, ya tenés el orden hecho.
    </p>
    <p>
      Fijate si tu plataforma optimiza las fotos al subirlas, porque entonces no hace falta comprimir ni achicar a mano; en Ecommy, por
      ejemplo, cada foto se reduce a 1600 px en su lado más largo y se convierte a WebP. Lo que sí importa es el formato de origen: JPG o PNG funcionan en
      todos lados, y el HEIC que guardan muchos iPhone no siempre se acepta. Si tu celular guarda en HEIC, cambiá en los ajustes de la cámara
      el formato a «Más compatible» o exportá en JPG.
    </p>
    <p>
      Completá también el texto alternativo de cada foto, una descripción corta como «Remera de lino blanca, vista de frente». Lo usan Google
      y las personas que navegan con lector de pantalla. En <Link href="/ayuda/cargar-un-producto">cargar un producto</Link> está el paso a
      paso, y el tope de fotos por producto, que depende del plan.
    </p>

    <h2 id="errores">Errores comunes</h2>
    <ul>
      <li>
        <strong>Flash del celular.</strong> Aplasta la tela y deja un brillo en el centro. Con luz de ventana no lo necesitás.
      </li>
      <li>
        <strong>Fondos distintos en cada producto.</strong> El listado se ve desordenado aunque cada foto esté bien.
      </li>
      <li>
        <strong>La prenda cortada.</strong> Sin mangas o sin ruedo, la clienta no sabe el largo. Dejá aire alrededor.
      </li>
      <li>
        <strong>Una sola foto.</strong> Sin espalda ni detalle, cada duda se convierte en un mensaje privado.
      </li>
      <li>
        <strong>Fotos del proveedor mezcladas con las tuyas.</strong> Cambian la luz, el fondo y a veces el color. Si las usás, que sea en
        todos los productos de esa línea.
      </li>
    </ul>

    <h2 id="una-tarde">Una tarde de fotos, paso a paso</h2>
    <ol>
      <li>Elegí entre 10 y 20 prendas, las que más te preguntan, y dejalas planchadas y sin etiquetas a la vista.</li>
      <li>Armá el fondo al lado de la ventana y marcá en el piso la distancia.</li>
      <li>Hacé una foto de prueba, compará el color con la prenda real y fijá foco y exposición.</li>
      <li>Fotografiá todas las prendas apoyadas, en el mismo orden de tomas; después, todas las puestas.</li>
      <li>Editá la tanda con los mismos valores, renombrá los archivos y subilos.</li>
    </ol>
    <p>
      Con las primeras veinte prendas bien fotografiadas ya podés compartir el link en tu bio y en tus historias. El resto lo sumás de a poco,
      con la misma ventana y la misma distancia, y la tienda se va a ver pareja desde el primer día.
    </p>
  </>
);
