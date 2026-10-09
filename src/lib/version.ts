/**
 * Versión de Ecommy y changelog: FUENTE ÚNICA. `/admin/changelog` y el pie
 * del sidebar leen de acá. `docs/CHANGELOG.md` es un espejo en markdown.
 * Al sumar una versión: agregá la entrada ARRIBA y actualizá APP_VERSION y
 * `package.json`.
 */

export const APP_NAME = "Ecommy";
export const APP_VERSION = "0.11.0";

/**
 * Versión del esquema de base de datos que espera este código. Se compara
 * con `app_meta.schema_version` (Configuración muestra un aviso si la base
 * está atrasada). Subila junto con la migración que la actualiza.
 */
export const SCHEMA_VERSION = 16;

export interface ChangelogEntry {
  version: string;
  /** ISO (YYYY-MM-DD). */
  date: string;
  title: string;
  sections: {
    added: string[];
    changed: string[];
    fixed: string[];
  };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.11.0",
    date: "2026-10-08",
    title: "Pasar la tienda a otra persona",
    sections: {
      added: [
        "Usuarios › «Pasar la tienda»: la tienda queda a nombre de otra persona con todo lo cargado. Si ya está en el equipo pasa al instante; si no, le llega un link por mail (vence en 7 días) para aceptarla con su cuenta o creándola. Vos elegís si seguís como administrador o salís del equipo.",
        "Antes de confirmar ves qué pasa: quién queda a cargo, qué pasa con vos, la prueba de Pro, el cobro con Mercado Pago, los datos de cobro que hay que revisar y quién más sigue en el equipo.",
        "La primera vez que una tienda cambia de dueño, si nunca se pagó un plan, quien la recibe arranca 14 días de Pro gratis.",
        "Mails al nuevo dueño: «ya está a tu nombre» o el link para recibirla, con lo que conviene revisar.",
        "Ayuda: «Pasar la tienda a otra persona».",
      ],
      changed: [
        "Usuarios marca quién tiene la tienda «A su nombre». A esa persona nadie le puede cambiar el rol, desactivarla ni sacarla del equipo: primero tiene que pasar la tienda.",
        "Al pasar la tienda se desconecta el cobro con tarjeta de Mercado Pago (la cuenta conectada es del dueño anterior). Con débito automático del plan vigente no se puede pasar hasta cancelar la renovación.",
        "Recibir una tienda respeta el máximo de 3 tiendas a tu nombre por cuenta.",
      ],
      fixed: [],
    },
  },
  {
    version: "0.10.0",
    date: "2026-10-05",
    title: "Hoy se resuelve desde el inicio, respuestas listas para WhatsApp y qué pasó esta semana",
    sections: {
      added: [
        "Inicio › «Resolver desde acá»: los pedidos por confirmar y por preparar con su siguiente paso en un toque («Confirmar pago», «Marcar preparado», «Marcar enviado»), con Deshacer y «Avisar por WhatsApp» sin abrir cada pedido.",
        "Inicio: la cabecera dice cuántas cosas tenés para resolver y, cuando no queda nada, «Listo por hoy».",
        "Inicio › «Qué pasó esta semana»: por qué vendiste más o menos que la semana pasada, con el producto que más cayó o subió, los precios que cambiaste y lo que se quedó sin stock. Sale de tus datos, sin inteligencia artificial.",
        "Responder: te preguntan por WhatsApp si tenés algo; buscás el producto, elegís la variante y copiás la respuesta con precio, stock, descuento por transferencia, cuotas y link. Sin stock, la respuesta ofrece el aviso de reposición. También respuestas listas para envío por zona, retiro y cómo pagar. Ecommy nunca manda nada solo.",
        "Ayuda: «Responder consultas de WhatsApp».",
      ],
      changed: [
        "Sitio de Ecommy: la landing cuenta la operación (vendés por WhatsApp e Instagram, Ecommy pone el orden) en lugar de la lista de funciones, con la sección «Antes / Con Ecommy» y «Hecho para vender en Argentina».",
        "Inicio: «Últimos pedidos» no repite los que ya están para resolver.",
      ],
      fixed: [],
    },
  },
  {
    version: "0.9.0",
    date: "2026-10-03",
    title: "Identidad nueva y estilos de tienda con disposición propia",
    sections: {
      added: [
        "Identidad nueva de Ecommy: tinta noche y pomelo, el logo en una burbuja, títulos en Archivo expandida y movimiento suave con curva en el sitio y el panel.",
        "Estilos de tienda con personalidad propia: cada uno de los 10 cambia la disposición (encabezado, portada, tarjeta de producto, grilla, filtros, ficha y pie), no sólo los colores.",
        "Portada con cinco disposiciones: foto a sangre, partida, enmarcada, titular gigante o apilada. Sin foto, se arma sola con tus productos.",
        "Bloques nuevos para tus páginas: marquesina y colección destacada, y más variantes de beneficios, categorías, testimonios, preguntas frecuentes y cuenta regresiva.",
        "Páginas › «Empezar desde una plantilla»: el inicio de fábrica de cada estilo, listo para aplicar y con Deshacer.",
        "Apariencia: «Disposición y movimiento» y «Catálogo y ficha» para elegir encabezado, tarjeta, grilla, filtros, galería, forma de las imágenes y cuánto se mueve la tienda.",
        "Inicio del panel: lo más urgente primero con su botón, la tarjeta «Tu tienda» con la vista real y el link para copiar, ventas en curva y primeros pasos con progreso.",
        "Pedidos: recorrido del pedido paso a paso en el detalle y vistas rápidas en la lista.",
        "Sitio de Ecommy: probá tu tienda escribiendo el nombre de tu negocio, calculadora de comisión y demostraciones del panel para usar ahí mismo.",
      ],
      changed: [
        "Las tiendas nuevas arrancan con el inicio pensado para su rubro. Las que nunca guardaron su apariencia toman la disposición nueva de su estilo; las que la guardaron conservan colores, tipografías, encabezado y pie.",
        "Panel: menú con la tienda activa arriba, barra inferior flotante en el celular, botones principales en tinta, links y foco en azul, estados en pastilla y la barra de guardado flotante.",
        "Planes, ingreso, registro, alta de tienda, ayuda, guías, contacto, mails de Ecommy y placas de redes con la identidad nueva.",
        "Los estilos Mercado y Lapacho cambian de paleta y tipografía para diferenciarse de Atelier.",
        "El sitio y la ayuda ya explican el cobro con tarjeta y cuotas con Mercado Pago.",
      ],
      fixed: [
        "Banners y categorías sin imagen ya no se ven como cajas grises: muestran un plano de color con el nombre.",
        "El encabezado transparente de la tienda sólo se usa sobre una portada con foto a sangre.",
      ],
    },
  },
  {
    version: "0.8.0",
    date: "2026-10-02",
    title: "Tarjetas y cuotas sin interés con Mercado Pago",
    sections: {
      added: [
        "Cobro con tarjeta: conectás tu cuenta de Mercado Pago en un paso (Configuración › Pagos) y tus clientes pagan con crédito, débito o dinero en cuenta, en cuotas. La plata entra directo a tu cuenta.",
        "Cuotas sin interés: elegís las que ofrecés (3, 6, 9 o 12) y la tienda las anuncia en cada producto y en el checkout («6 cuotas sin interés de $ X»), con el paso a paso para activarlas en Mercado Pago y la tabla de comisiones.",
        "Checkout: «Tarjeta de crédito o débito» con el valor de cada cuota; al confirmar te lleva a Mercado Pago y vuelve al pedido.",
        "Página del pedido: «Estamos confirmando tu pago», pago en revisión, rechazo con el motivo y «Reintentar el pago», y «Pagaste con Visa ••4242 en 6 cuotas».",
        "Los pagos aprobados marcan el pedido como pagado solos (con el descuento de stock si lo tenés al pagar) y le llega el mail de pago confirmado al comprador. Devoluciones y contracargos también se reflejan.",
        "Pedido en el panel: detalle del pago de Mercado Pago (estado, cuotas, tarjeta e ID con link).",
      ],
      changed: [
        "Un pedido con un pago de Mercado Pago en revisión no se cancela por vencimiento de la reserva durante 48 h.",
      ],
      fixed: [],
    },
  },
  {
    version: "0.7.0",
    date: "2026-10-02",
    title: "Apps de Ecommy y Taller 3D",
    sections: {
      added: [
        "Apps: módulos extra que se suman a una tienda. Se ven en Sistema › Apps y los activa Ecommy desde la plataforma (activa, prueba con vencimiento o desactivada).",
        "Taller 3D, la primera app, para talleres de impresión 3D: el cliente sube su STL o 3MF en la tienda (/impresion-3d), lo ve en 3D sobre la cama, elige material, color, calidad, relleno y soportes, y ve el precio, los gramos, las horas y la fecha en que lo tiene listo.",
        "Taller 3D: cotizaciones con revisión manual cuando la pieza no entra, tarda demasiado, tiene la malla abierta o falta filamento; el taller verifica el archivo, ajusta el precio y aprueba. La cotización aprobada se paga con el checkout de siempre.",
        "Taller 3D: cola de impresión con una columna por impresora (arrastrar y soltar, empezar, terminar, falló y reimprimir), «Sugerir asignación» y «Pedidos por producir» para productos del catálogo que se imprimen.",
        "Taller 3D: impresoras con presets de modelos comunes, estante de bobinas con gramos restantes y aviso de stock bajo, calidades, precios con simulador en vivo y calibración automática con los gramos y minutos reales.",
        "Taller 3D: costo real de cada pedido (filamento, luz, amortización, post-proceso y fallas) contra lo cobrado, en el pedido y en el resumen del taller.",
        "Tienda: «Se imprime a pedido · listo aprox. el …» en la ficha de productos fabricados a pedido y bloque «Cotizador 3D» para las páginas.",
      ],
      changed: [],
      fixed: [],
    },
  },
  {
    version: "0.6.0",
    date: "2026-10-01",
    title: "Marca Ecommy y rediseño de la experiencia",
    sections: {
      added: [
        "Manual de marca de Ecommy: personalidad, voz, logo, colores, tipografía y reglas de uso. La landing, el registro y el panel lo siguen.",
        "Panel en el celular: barra inferior con Inicio, Pedidos, Productos, Compartir y Menú, y controles de 44 px en pantallas táctiles.",
        "Pedidos: botón de siguiente paso en cada pedido («Confirmar pago», «Marcar enviado»…) con Deshacer; «Confirmar pago» registra el cobro, confirma el pedido y ofrece avisar por WhatsApp.",
        "Apariencia: interruptor «Hecho con Ecommy» en el pie de la tienda, apagable desde Starter. El estilo de tu rubro aparece primero y el control de contraste tiene «Ajustar».",
        "Productos: «Crear y cargar otro», «Publicar al crear», stock editable en la fila del inventario y «Cambiar precios» desde la selección.",
      ],
      changed: [
        "Inicio del panel muestra primero lo que hay que hacer hoy (pedidos por confirmar, para despachar, sin stock) y deja las métricas al final.",
        "Crear una tienda lleva 2 pasos en vez de 3: la dirección sale del nombre, el WhatsApp se acepta en cualquier formato y los datos de cobro quedan para después. El registro pide 3 datos.",
        "Al ingresar vas directo al panel de tu tienda.",
        "El alta de producto muestra primero nombre, fotos, precio y stock; lo demás queda plegado. Los listados del panel se ven como tarjetas en el celular.",
        "Configuración tiene pestañas entre sus secciones y un solo botón Guardar.",
        "Los estilos Nórdico y Galpón se diferencian mejor, y Atelier corrige el contraste del texto sobre su banda de color.",
        "En el menú, «Dashboard» pasa a llamarse «Inicio» y «Changelog» pasa a «Novedades»; Importar se mudó a Catálogo.",
        "Mejor contraste en el panel: bordes de los campos y anillo de foco.",
      ],
      fixed: [
        "Crear tienda ya no te devuelve al paso 1 cuando el WhatsApp faltaba.",
        "«Ver tienda» desde el buscador del panel abría la página de Ecommy en vez de tu tienda.",
        "En una banda de color de la tienda, el botón y las tarjetas ya no quedan del mismo color que el fondo.",
      ],
    },
  },
  {
    version: "0.5.0",
    date: "2026-09-23",
    title: "Plan anual, carritos abandonados y precios por cantidad",
    sections: {
      added: [
        "Pago anual en Starter y Pro: 12 meses por el precio de 10. Las tarjetas de planes muestran «Pagando el año: … · $ X por mes»; en Plan podés pagar el año con MercadoPago o pedirlo por WhatsApp, y quien ya tiene un plan mensual puede pasarse al anual. La plataforma carga el precio y el plan anual de MercadoPago por plan.",
        "Recuperación de carritos abandonados (Starter en adelante, se activa en Configuración › Pagos y checkout): en el checkout aparece «Avisame por mail si dejo el pedido sin terminar», destildado. A quien lo tilda y no confirma le llega un solo mail con su carrito y «Terminar mi pedido», que lo vuelve a armar con los precios de hoy; desde el mismo mail se puede dar de baja. Pedidos › Carritos abandonados muestra quién dejó el checkout y en qué estado está.",
        "Precios por cantidad por producto (desde Starter): «desde 6 unidades $ X, desde 12 $ Y», hasta 4 tramos con el ahorro en %. Se suman todas las variantes del producto y las promociones, el cupón y el descuento por medio de pago se aplican encima. En la ficha el precio cambia con la cantidad y hay una tabla «Precio por cantidad»; la card dice «Desde 6 u. $ X»; el carrito y el checkout muestran la fila «Precio por cantidad».",
      ],
      changed: [
        "La pantalla Plan y los mails de cobro indican si el plan es mensual o anual. Las preguntas frecuentes explican el pago anual y ya no dicen que MercadoPago «llega en la próxima versión».",
        "Duplicar un producto copia también sus precios por cantidad.",
        "Requiere aplicar las migraciones 0019 a 0021 (en orden): plan anual, carritos abandonados y precios por cantidad.",
      ],
      fixed: [],
    },
  },
  {
    version: "0.4.1",
    date: "2026-09-23",
    title: "Kit de redes, CI y una landing más rápida",
    sections: {
      added: [
        "Plataforma › Redes: piezas listas para Instagram y TikTok. Los 15 posts y reels y las 10 historias del kit se generan como imágenes de 1080 × 1080 y 1080 × 1920 con la marca, se descargan en PNG y tienen «Copiar texto» con gancho, texto, CTA y hashtags. Las que dependen de una grabación real se marcan «Completar antes de publicar» hasta que escribís el dato.",
        "Cada cambio del código pasa automáticamente por tipos, lint, tests y un build, más una recorrida del sitio público en computadora y en celular (páginas, SEO básico, links, sitemap, buscador de ayuda).",
      ],
      changed: [
        "La página de inicio carga más rápido: las fuentes de las muestras de estilos se piden recién cuando la muestra se acerca en pantalla, y nada bloquea el primer render.",
        "El centro de ayuda y las guías se sirven como páginas estáticas desde la CDN; los íconos y las imágenes para compartir se cachean un día.",
      ],
      fixed: [
        "Las imágenes para compartir el sitio ya no tienen espacios dobles entre palabras.",
      ],
    },
  },
  {
    version: "0.4.0",
    date: "2026-09-23",
    title: "Cobro con MercadoPago, avisos de stock y promos 3x2",
    sections: {
      added: [
        "Pagá tu plan con MercadoPago desde Plan: débito automático mensual con tarjeta o dinero en cuenta. El plan se activa cuando MercadoPago confirma el cobro (o con 7 días de gracia si autoriza antes de cobrar) y te llega un mail con la fecha del próximo cobro. «Cancelar renovación» te deja seguir hasta el fin del período pago y después la tienda pasa a Free sin borrar nada. Si MercadoPago no puede cobrar, Plan te avisa y te llega un mail.",
        "Panel de la plataforma: id del plan de MercadoPago por plan, estado de la suscripción de cada tienda y «Sincronizar con MercadoPago».",
        "«Avisame cuando haya stock»: en la ficha de un producto agotado el cliente deja su email y le llega un mail con el link y el precio cuando cargás stock. En Inventario › Avisos de stock ves quién espera cada producto y a quién ya se avisó.",
        "Promociones «Llevá X, pagá Y» (2x1, 3x2, 4x3…) y «N.ª unidad con descuento» (por ejemplo, 2.ª unidad al 50 %) para toda la tienda, categorías o productos. Las unidades se agrupan de a X de la más cara a la más barata y en cada grupo sale gratis la más barata. Las cards muestran el badge, la ficha «Llevá 3 y pagá 2» y el carrito, el checkout, el seguimiento, el remito y los mails muestran «Promociones por cantidad» como una línea del pedido, en pesos enteros.",
      ],
      changed: [
        "El pedido de plan por WhatsApp sigue disponible al lado del pago con MercadoPago. Sólo el dueño puede pagar o cancelar la renovación.",
        "La sección Ofertas de la tienda incluye los productos con promociones por cantidad.",
        "El menú del panel resalta sólo la sección más específica (Inventario y Avisos de stock ya no se marcan a la vez).",
        "Requiere aplicar las migraciones 0015 a 0018 (en orden): cobro de planes, avisos de stock, promociones por cantidad y descuento a nivel pedido.",
      ],
      fixed: [
        "El checkout valida en la base el descuento de las promociones por cantidad con la misma regla que la tienda, así nadie puede armar un pedido con más descuento del que corresponde.",
        "Un producto que sólo suma unidades para un 3x2 conserva su propia promoción, y sumar un producto barato ya no encarece el pedido.",
      ],
    },
  },
  {
    version: "0.3.0",
    date: "2026-09-23",
    title: "Centro de ayuda, avisos de activación y seguridad",
    sections: {
      added: [
        "Centro de ayuda en /ayuda con 14 artículos cortos y buscador: cargar e importar productos, cobrar, zonas de envío, personalizar la tienda, compartirla, medir, cumplir con los legales y manejar el plan y el equipo, con los nombres de cada pantalla tal como aparecen en el panel. «Ayuda» en el menú del panel y en el sitio.",
        "Guías en /guias para quien todavía no tiene tienda: vender por WhatsApp sin perder pedidos, botón de arrepentimiento, precio sin impuestos nacionales y cómo migrar la tienda sin perder Google.",
        "Avisos por mail a los dos días de crear la tienda si todavía no tiene productos, y a la semana si tiene productos pero no se compartió el link ni hubo pedidos (cuando la plataforma tiene configurado el envío).",
      ],
      changed: [
        "El mail «Recibimos tu pedido» ya no repite la nota del comprador y sólo saluda por el nombre cuando es un nombre de verdad; en los avisos al vendedor, la nota y el motivo del comprador aparecen rotulados y recortados (el pedido completo sigue en el panel).",
        "Sólo el dueño o un administrador pueden pedir un cambio de plan, y el pedido llega una vez por día por plan.",
        "Mejoras de seguridad en el envío de emails (cupo de avisos por comprador y por tienda para que el checkout no sirva para mandar spam) y en las cabeceras del sitio. Requiere aplicar la migración 0014.",
      ],
      fixed: [
        "El aviso «tu prueba terminó» siempre llega, aunque el mantenimiento diario haya corrido antes.",
        "Las páginas de la tienda no pueden llamarse icon, apple-icon ni opengraph-image (chocaban con el ícono del sitio).",
      ],
    },
  },
  {
    version: "0.2.0",
    date: "2026-09-23",
    title: "Listos para el primer MVP público",
    sections: {
      added: [
        "Sitio de Ecommy renovado: cómo funciona en tres pasos, muestras de los diez estilos por rubro, qué plan incluye cada función (calculado desde los planes publicados), ejemplo de un pedido sin comisión, preguntas frecuentes y contacto.",
        "Términos del servicio y política de privacidad (Ley 25.326) con índice y fecha de actualización, enlazados desde el pie y desde el registro; página de contacto con mail, WhatsApp y el plan Business a medida.",
        "Ícono de Ecommy en la pestaña y en la pantalla de inicio del celular, e imagen propia al compartir los links de Ecommy en WhatsApp y redes.",
        "Emails automáticos (cuando la plataforma tiene configurado el envío): al comprador cuando hace el pedido, se confirma el pago, se despacha o se cancela; al vendedor cuando entra un pedido o una solicitud de arrepentimiento; al dueño de la cuenta al crear la tienda y cuando la prueba de Pro está por terminar o terminó.",
        "Nueva sección Marketing › Compartir: tu link con «Copiar», el QR de tu tienda para descargar e imprimir, y mensajes listos para pegar en la bio de Instagram, para responder por WhatsApp y para historias, armados con tu descuento por transferencia y tu envío gratis si los tenés. También el link o el QR de un producto o categoría.",
        "Una franja arriba del panel te avisa cuántos días de prueba te quedan y, el último día, a qué hora termina. En Free, un recordatorio de los límites del plan que se puede cerrar por 7 días.",
        "En Configuración › Tienda, el email de contacto aclara que ahí llegan los avisos de pedidos y arrepentimientos.",
        "Medición del sitio de Ecommy con Google Analytics 4 y verificación de Search Console, configurables por variables de entorno.",
      ],
      changed: [
        "El paso «Compartí el link de tu tienda» de los primeros pasos lleva a la nueva sección Compartir; copiar cualquier link desde ahí lo marca como hecho.",
        "Las preguntas frecuentes de Planes son las mismas que las de la página de inicio, y «Hablemos» del plan Business lleva a Contacto.",
      ],
      fixed: [
        "Los links de términos y privacidad del registro llevaban a Planes.",
        "En hosts de tienda con subdominio o dominio propio, el ícono de la pestaña ya no da 404 cuando la tienda no cargó un favicon propio.",
        "La página de inicio de Ecommy ya no tiene scroll horizontal en celulares.",
      ],
    },
  },
  {
    version: "0.1.2",
    date: "2026-09-23",
    title: "Diez estilos de tienda y selector nuevo",
    sections: {
      added: [
        "Cinco estilos nuevos: Botica (farmacia y perfumería), Recreo (librería y juguetería), Lapacho (muebles e iluminación), Galpón (mayoristas) y Bodega (vinos y gourmet). Cada uno tiene su rubro en el alta de tienda.",
        "Selector de estilos con miniatura fiel de cada tema, modo para ver y comparar los diez con la vista previa real, probar antes de aplicar y filtros por rubro, fondo claro u oscuro y plan.",
      ],
      changed: [
        "Los cinco estilos existentes se revisaron: Neón deja el lima sobre negro por grafito con un solo ámbar, Mercado pierde las sombras y el botón tintado, y en Nórdico y Editorial la oferta y el error ya no usan dos rojos casi iguales.",
        "Los bordes de inputs y controles tienen más contraste en todos los estilos.",
      ],
      fixed: [
        "En la ficha de producto desde una computadora, la foto principal ya no ocupa más alto que la pantalla: entra completa, con las miniaturas al lado.",
        "La fuente Libre Caslon Text ya carga siempre (se pedían pesos que no existen).",
      ],
    },
  },
  {
    version: "0.1.1",
    date: "2026-09-23",
    title: "Editor de páginas más fluido",
    sections: {
      added: [],
      changed: [
        "La vista previa del editor de páginas sólo actualiza los bloques que cambiaste; volver a un valor anterior o alternar entre computadora y celular es instantáneo.",
      ],
      fixed: [
        "Editar un bloque ya no hace parpadear todo el editor de páginas con la pantalla de carga ni lleva la vista previa arriba de todo.",
        "El checkout de las tiendas volvió a funcionar para los visitantes.",
      ],
    },
  },
  {
    version: "0.1.0",
    date: "2026-09-22",
    title: "Plataforma multi-tienda",
    sections: {
      added: [
        "Plataforma multi-tienda, registro y planes: cualquier persona se registra, crea su tienda en tres pasos y la administra desde su propio panel.",
        "Sitio de Ecommy con planes (Free, Starter, Pro y Business), registro, ingreso y recuperación de contraseña.",
        "Mis tiendas: hasta tres tiendas por cuenta y selector de tienda en el panel.",
        "Planes con funciones y límites por tienda; cada tienda nueva arranca con 14 días de Pro gratis.",
        "Pantalla Plan en el panel: uso contra los límites, comparación y pedido de cambio de plan por WhatsApp.",
        "Checklist de primeros pasos en el dashboard, que se tilda solo a medida que dejás lista la tienda.",
        "Equipo por tienda: invitaciones por link, roles por tienda y quitar a alguien del equipo.",
        "Panel de la plataforma para administrar tiendas, planes y pruebas.",
        "Barrido diario automático de pruebas vencidas y reservas sin pagar.",
      ],
      changed: [
        "Cada tienda tiene sus propios productos, pedidos, clientes, páginas, imágenes y configuración, aislados del resto.",
        "El ingreso pasó de /admin/login a /login, y el alta del primer dueño se reemplazó por el registro.",
        "Las tiendas se ven en su subdominio o, mientras no haya dominio propio, en /s/<tienda>.",
      ],
      fixed: [],
    },
  },
  {
    version: "0.0.0",
    date: "2026-09-22",
    title: "Primera versión de Ecommy",
    sections: {
      added: [
        "Base de datos completa en Supabase con seguridad por filas (RLS) en todas las tablas.",
        "Acceso al panel con email y contraseña, alta del primer dueño y aprobación de cuentas nuevas.",
        "Panel de administración con navegación lateral, buscador rápido (Ctrl+K) y diseño propio.",
        "Catálogo con productos, variantes, imágenes, categorías e inventario con historial de movimientos.",
        "Pedidos con número correlativo, seguimiento público por enlace secreto, pagos y línea de tiempo.",
        "Clientes con historial de compras y total gastado.",
        "Motor de precios: promociones, cupones, descuento por método de pago y envío gratis desde un monto.",
        "Checkout sin pasarela: transferencia bancaria con descuento o coordinación por WhatsApp.",
        "Zonas de envío por polígono, provincia o código postal, y puntos de retiro.",
        "Apariencia de la tienda: 5 estilos prearmados, colores, tipografías de Google Fonts, radios y botones.",
        "Constructor de páginas por bloques (portada, carruseles, banners, texto y más).",
        "Menús de encabezado y pie editables.",
        "Importación del catálogo desde otras tiendas.",
        "Configuración general, usuarios con roles, registro de auditoría y este changelog.",
        "Configuración de la tienda, pagos y checkout con validación de CBU, alias y CUIT, y plazo de reserva de stock.",
        "Impuestos y legales: precio sin impuestos nacionales, Defensa del Consumidor, Data Fiscal y plantillas de políticas para Argentina.",
        "SEO global, Google Analytics 4, Tag Manager, Meta Pixel, modo mantenimiento y redirecciones 301 con importación CSV.",
        "Exportación CSV de productos, inventario, pedidos, clientes y auditoría.",
      ],
      changed: [],
      fixed: [],
    },
  },
];
