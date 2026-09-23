# Ecommy: checklist del dueño para el lanzamiento

> Todo lo que sólo vos podés hacer (cuentas, credenciales, dinero, firmas, decisiones). Cada ítem dice **por qué** y **dónde**. Marcá con `[x]` y anotá la fecha.
> Contexto: [`DEPLOY.md`](DEPLOY.md) (Vercel, dominio, Supabase Auth, cron), [`BILLING.md`](BILLING.md) (cobro de planes), [`LAUNCH-PLAN.md`](LAUNCH-PLAN.md) (fases), [`SOCIAL-KIT.md`](SOCIAL-KIT.md) (textos).

---

## 0. Bloqueantes: antes de invitar al primer comercio beta

Resumen de los ítems de abajo sin los que no conviene abrir. Si falta uno, la beta espera.

- [ ] SMTP propio en Supabase Auth (§2.3) y plantillas de mail con marca (§2.4). Sin esto, los mails de confirmación pueden no llegar.
- [ ] `PLATFORM_WHATSAPP` cargado y probado desde `/admin/plan` y `/planes` (§4.1).
- [ ] Términos y privacidad publicados y revisados por un abogado (§7.1).
- [ ] Planes de Vercel y Supabase aptos para uso comercial, con backups (§10.1 y §10.2).
- [ ] Permiso por escrito para mostrar el catálogo de la tienda demo, o demo reemplazada (§11.1).
- [ ] Recorrido completo en producción: registro → confirmación de mail → `/app/nueva` → producto → checkout por transferencia y por WhatsApp → pedido visible en `/admin/pedidos` ([`DEPLOY.md`](DEPLOY.md) §5).
- [ ] Cómo vas a cobrar los planes mientras no esté Mercado Pago: cuenta, alias y planilla (§8.1).
- [ ] Horario y canal de soporte definidos (§9).

---

## 1. Dominio y DNS

Según [`DEPLOY.md`](DEPLOY.md), `www.ecommy.app` es el canónico y el comodín `*.ecommy.app` ya está verificado en Vercel. Estos ítems confirman que todo quedó bien.

- [ ] **Renovación automática de `ecommy.app` activada** — si el dominio vence, se caen la plataforma y todas las tiendas a la vez. Dónde: el registrador (o Vercel → Domains si lo compraste ahí).
- [ ] **Nameservers de Vercel** (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) — el comodín los exige; todos los registros de mail (§3) se cargan en Vercel. Dónde: Vercel → Domains → `ecommy.app`.
- [ ] **Certificado del comodín funcionando** — abrí `https://demo.ecommy.app` y una tienda recién creada en el celular, sin avisos de seguridad. Dónde: navegador.
- [ ] **`NEXT_PUBLIC_SITE_URL` igual al canónico** (`https://www.ecommy.app`) — los links de los mails de Auth y la metadata salen de ahí. Ojo: [`DEPLOY.md`](DEPLOY.md) §6 paso 2 dice `https://ecommy.app` y la tabla §1 dice `www`; elegí uno, dejalo igual en Vercel y en Supabase (§2.1). Dónde: Vercel → Settings → Environment Variables (redeploy después).
- [ ] **Subdominios de mail reservados** — si usás `send.ecommy.app` (Resend) o similares, que ninguna tienda pueda tomar ese slug. Hoy los reservados son `www, app, admin, api, mail, ecommy, platform, static, cdn`; pedí al dev que sume los que uses. Dónde: `create_store()` y `src/lib/tenant/`.

## 2. Supabase Auth

- [ ] **2.1 Site URL y Redirect URLs** — sin esto, el link de confirmación lleva a un error. Valores exactos en [`DEPLOY.md`](DEPLOY.md) §3. Dónde: Supabase → Authentication → URL Configuration.
- [ ] **2.2 Confirmación de email activada y "Leaked password protection"** — evita cuentas con mails falsos y contraseñas filtradas. Dónde: Supabase → Authentication → Providers → Email / Sign In.
- [ ] **2.3 SMTP propio (Resend)** — el SMTP incluido de Supabase tiene un límite muy bajo de envíos por hora: el día del lanzamiento se cortan los registros. Datos: host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = una API key de Resend, remitente `hola@ecommy.app`, nombre "Ecommy". Requiere el dominio verificado en Resend (§3.2). Dónde: Supabase → Authentication → Emails → SMTP Settings.
- [ ] **2.4 Plantillas con marca, en castellano** — los mails en inglés parecen phishing. Pegá las de abajo (texto plano con un link: se entregan mejor que un HTML cargado). Dónde: Supabase → Authentication → Emails → Templates.
- [ ] **2.5 Subir el límite de envío de mails** una vez que el SMTP propio funcione — el límite por defecto frena registros simultáneos. Dónde: Supabase → Authentication → Rate Limits.
- [ ] **2.6 Probar los dos mails** (registro y "olvidé mi contraseña") con una cuenta de Gmail y una de Outlook o Hotmail, y confirmar que no caen en spam. Dónde: `/registro` y `/login`.

**Confirmar registro** · Asunto: `Confirmá tu mail para crear tu tienda en Ecommy`

```html
<p>Hola,</p>
<p>Para terminar tu registro en Ecommy, confirmá tu mail con este link:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar mi mail</a></p>
<p>Después elegís el nombre de tu tienda y arrancás con 14 días de Pro gratis, sin tarjeta.</p>
<p>Si no te registraste en Ecommy, ignorá este mensaje.</p>
<p>Ecommy · ecommy.app · Respondé este mail si necesitás ayuda.</p>
```

**Restablecer contraseña** · Asunto: `Cambiá tu contraseña de Ecommy`

```html
<p>Hola,</p>
<p>Pediste cambiar la contraseña de tu cuenta de Ecommy ({{ .Email }}). Elegí una nueva desde este link:</p>
<p><a href="{{ .ConfirmationURL }}">Elegir una contraseña nueva</a></p>
<p>El link vence pronto y sirve una sola vez. Si no lo pediste, ignorá este mensaje: tu contraseña sigue igual.</p>
<p>Ecommy · ecommy.app</p>
```

**Cambio de mail** (si se usa) · Asunto: `Confirmá tu nuevo mail en Ecommy`

```html
<p>Hola,</p>
<p>Confirmá que querés usar este mail en tu cuenta de Ecommy:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar el cambio</a></p>
<p>Si no lo pediste, respondé este mail y lo revisamos.</p>
```

## 3. Mail: casilla y envíos transaccionales

- [ ] **3.1 Casilla `hola@ecommy.app`** (Google Workspace o Zoho Mail) — va en bios, mails fríos, políticas y como remitente; un Gmail personal resta confianza. Cargá los MX y el SPF que te dé el proveedor en Vercel DNS. Dónde: consola del proveedor + Vercel → Domains → `ecommy.app` → DNS Records.
- [ ] **3.2 Dominio verificado en Resend** — sin esto no salen los mails automáticos (otro agente está implementando emails detrás de `RESEND_API_KEY` y `EMAIL_FROM`). Agregá `ecommy.app` en Resend y copiá **exactamente** los registros que muestra (DKIM en `resend._domainkey` y MX + SPF en el subdominio de envío, por defecto `send`). No chocan con los MX de la casilla porque van en subdominios. Dónde: resend.com → Domains + Vercel DNS.
- [ ] **3.3 Un solo SPF por nombre** — dos registros SPF en el mismo nombre invalidan ambos. En la raíz: sólo el del proveedor de la casilla. Dónde: Vercel DNS.
- [ ] **3.4 DMARC** — Gmail y Yahoo lo exigen a remitentes con volumen. Empezá con `_dmarc.ecommy.app` TXT `v=DMARC1; p=none; rua=mailto:hola@ecommy.app` y, cuando los reportes estén limpios (2 a 4 semanas), pasá a `p=quarantine`. Dónde: Vercel DNS.
- [ ] **3.5 Variables en Vercel**: `RESEND_API_KEY` (marcada como *sensitive*) y `EMAIL_FROM` (`Ecommy <hola@ecommy.app>`), en Production. Redeploy después. Dónde: Vercel → Settings → Environment Variables y [`DEPLOY.md`](DEPLOY.md) §1.
- [ ] **3.6 Prueba de entregabilidad** — mandate un mail de prueba y revisá los encabezados (SPF, DKIM y DMARC en `pass`). Dónde: Gmail → "Mostrar original".

## 4. WhatsApp de la plataforma

- [ ] **4.1 `PLATFORM_WHATSAPP`** con el número en formato internacional sin `+` ni `15` (`549` + característica + número, por ejemplo `5491123456789`) — "Quiero este plan" en `/admin/plan` y "Hablemos" en `/planes` abren ese chat; sin la variable, el botón de Business manda a `/registro`. Dónde: Vercel → Environment Variables (redeploy) y [`DEPLOY.md`](DEPLOY.md) §1.
- [ ] **4.2 Número dedicado con WhatsApp Business** (no tu personal) — separa soporte de vida personal y permite horario, respuestas rápidas y etiquetas. Dónde: app WhatsApp Business.
- [ ] **4.3 Perfil**: nombre "Ecommy", descripción, horario, `hola@ecommy.app` y `https://www.ecommy.app`. Textos en [`SOCIAL-KIT.md`](SOCIAL-KIT.md) §1.4.
- [ ] **4.4 Catálogo con los 4 planes** (nombre, precio vigente, qué incluye, link a `/planes`) — respuesta visual a "¿cuánto sale?". Actualizalo cada vez que cambies precios. Dónde: WhatsApp Business → Herramientas → Catálogo.
- [ ] **4.5 Mensaje de bienvenida, mensaje de ausencia y respuestas rápidas** — textos en [`SOCIAL-KIT.md`](SOCIAL-KIT.md) §1.4 y §8. Dónde: WhatsApp Business → Herramientas.
- [ ] **4.6 Etiquetas**: `Beta`, `Prueba activa`, `Pidió plan`, `Pago pendiente`, `Cliente`, `Aliado` — es tu CRM mientras no haya otro. Dónde: WhatsApp Business → Etiquetas.
- [ ] **4.7 Número de respaldo** anotado — si Meta bloquea el principal, cambiás `PLATFORM_WHATSAPP` y la bio en minutos. Nunca mandes mensajes en masa (ver §10.4).

## 5. Medición

- [ ] **5.1 GA4 en la landing** — hoy la landing no carga GA4 (el GA4 que existe es el de cada tienda). Pedí al dev que lo agregue detrás de una variable (por ejemplo `NEXT_PUBLIC_PLATFORM_GA_ID`) con los eventos `sign_up` y `store_created`. Después: creá la propiedad GA4 "Ecommy · plataforma", cargá el ID y marcá `sign_up` como evento clave. Dónde: analytics.google.com + Vercel env.
- [ ] **5.2 Google Search Console** con propiedad de dominio `ecommy.app` (verificación por TXT en Vercel DNS) y enviar `https://www.ecommy.app/sitemap.xml` — sin esto no sabés con qué búsquedas aparecés. Dónde: search.google.com/search-console.
- [ ] **5.3 Meta Pixel (dataset) de la landing** — sólo si vas a pautar en Meta; necesita el mismo cambio de código que 5.1. Verificá el dominio `ecommy.app` en Meta Business (TXT en Vercel DNS). Dónde: Meta Business → Administrador de eventos y Seguridad de la marca → Dominios.
- [ ] **5.4 Planilla semanal** con las consultas de [`LAUNCH-PLAN.md`](LAUNCH-PLAN.md) §2.2 guardadas como snippets. Dónde: Supabase → SQL Editor.
- [ ] **5.5 Convención de UTM** fijada y usada en toda bio y link ([`LAUNCH-PLAN.md`](LAUNCH-PLAN.md) §2.3).

## 6. Redes y marca

- [ ] **6.1 Handles**: reservá el mismo nombre en Instagram, TikTok, LinkedIn (página de empresa), YouTube y X aunque no los uses todos. Probá en este orden: `ecommy`, `ecommy.app`, `ecommyapp`, `ecommy.ar`. Dónde: cada red.
- [ ] **6.2 Instagram profesional** con bio, link con UTM y 3 posts fijados (P01, P02 y P08 del kit) antes de invitar gente. Dónde: Instagram. Textos: [`SOCIAL-KIT.md`](SOCIAL-KIT.md) §1.
- [ ] **6.3 TikTok** con bio y link. Dónde: TikTok.
- [ ] **6.4 Página de empresa en LinkedIn** + tu perfil de fundador actualizado (titular y "acerca de"). Dónde: LinkedIn. Textos: [`SOCIAL-KIT.md`](SOCIAL-KIT.md) §1.3.
- [ ] **6.5 Meta Business (portafolio comercial)** con la cuenta de Instagram, el WhatsApp Business y, si pautás, la cuenta publicitaria con un medio de pago. Dónde: business.facebook.com.
- [ ] **6.6 Logo e imagen de perfil** consistentes (marca sin brillo ni gradiente, colores de la plataforma: pino `#2e4a3f` y ámbar `#e0a458`, ver [`DESIGN.md`](DESIGN.md) §7). Dónde: todas las cuentas.
- [ ] **6.7 Google Business Profile**: sólo si tenés dirección para mostrar; si no, no hace falta. Dónde: business.google.com.

## 7. Legal, marca y fiscal

- [ ] **7.1 Términos y condiciones y política de privacidad revisados por un abogado** — otro agente está creando `/terminos` y `/privacidad` con un borrador. Pedí que cubra: Ecommy como encargado del tratamiento de los datos de los compradores de cada tienda, responsabilidad del comercio por lo que vende y por sus precios, productos prohibidos, suspensión de tiendas, cambios de precio de los planes, qué pasa con los datos al cancelar, jurisdicción. Dónde: `/terminos` y `/privacidad`.
- [ ] **7.2 Ley 25.326 de datos personales**: preguntale al abogado si corresponde inscribir las bases de datos ante la AAIP y qué hace falta en la política de privacidad. Dónde: argentina.gob.ar/aaip.
- [ ] **7.3 Defensa del consumidor para la propia Ecommy**: preguntale si la suscripción a Ecommy necesita botón de arrepentimiento, link a Defensa del Consumidor y Data Fiscal en `ecommy.app` (muchos monotributistas contratan como consumidores finales). Dónde: abogado; después, pedido de código.
- [ ] **7.4 Registro de la marca "Ecommy" en el INPI** — primero una búsqueda de antecedentes (clases 35 y 42 como mínimo). Si hay una marca igual o parecida, es mejor saberlo antes de imprimir tarjetas y hacer crecer las redes. Dónde: portal del INPI o un agente de la propiedad industrial.
- [ ] **7.5 Alta fiscal**: monotributo (o responsable inscripto) con la actividad correcta para software como servicio, e ingresos brutos. El contador define la categoría y si conviene Convenio Multilateral. Dónde: ARCA + tu contador.
- [ ] **7.6 Facturación**: factura electrónica (C si sos monotributista) por cada pago de plan, con el CUIT o DNI del comercio. Precios finales con impuestos incluidos, como dice [`BILLING.md`](BILLING.md). Dónde: ARCA → Comprobantes en línea (o el sistema que elija el contador).
- [ ] **7.7 Revisar las plantillas legales para tiendas** (`src/lib/legal/templates.ts`) con el mismo abogado — las usan todos los comercios. Dónde: `/admin/configuracion/legales` en la demo.
- [ ] **7.8 Guía de Ley 27.743 y Res. SIC 4/2025 (precio sin impuestos nacionales)** revisada antes de publicar el artículo de contenido sobre legales ([`MARKETING.md`](MARKETING.md) §6.4). Dónde: abogado o contador.

## 8. Cobro de planes y altas manuales

- [ ] **8.1 Cobro manual (v0.1)** — hoy "Quiero este plan" abre tu WhatsApp. Definí: cuenta y alias de cobro a nombre del titular fiscal, precio vigente en `/platform/planes`, planilla con tienda, plan, monto, fecha de pago, próximo vencimiento y número de factura. Proceso: recibís el pedido → mandás alias y monto (respuesta rápida `/pago`) → llega el comprobante → activás en `/platform/tiendas/<id>` → facturás. Dónde: `/platform` y tu banco.
- [ ] **8.2 Precios definitivos y plan anual** decididos (ver [`MARKETING.md`](MARKETING.md) §5) y cargados en `/platform/planes`; catálogo de WhatsApp actualizado. Dónde: `/platform/planes`.
- [ ] **8.3 Recordatorio de vencimientos**: los días 10 y 13 de cada prueba y 3 días antes de cada renovación, mensaje por WhatsApp (texto en [`SOCIAL-KIT.md`](SOCIAL-KIT.md) §8). Dónde: planilla + `/platform` (columna de fin de prueba).
- [ ] **8.4 Mercado Pago para cobrar los planes (v0.2)** — cobro automático con suscripciones. Cuenta de vendedor verificada, aplicación en Mercado Pago Developers, credenciales de producción, webhook apuntando a `/api/billing/mercadopago`. Variables `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `BILLING_RPC_SECRET`. Dónde: [`BILLING.md`](BILLING.md) y mercadopago.com.ar/developers.
- [ ] **8.5 Procedimiento de dominio propio de un cliente (Pro)** — hoy es manual: agregás el dominio del cliente al proyecto en Vercel, el cliente crea el CNAME `cname.vercel-dns.com` en su proveedor, y cargás `custom_domain` + verificado en `/platform` (o por SQL). Anotá cuánto tarda y armá el mensaje con los pasos para el cliente. Dónde: [`DEPLOY.md`](DEPLOY.md) §6.5.
- [ ] **8.6 Extensión de pruebas para la beta y los referidos** — se hace en `/platform/tiendas/<id>` cambiando el fin de la prueba. Anotá en la planilla a quién y por qué.

## 9. Soporte

- [ ] **9.1 Política de soporte escrita** — horario (sugerido: lunes a viernes de 9 a 18), canales (WhatsApp de la plataforma y `hola@ecommy.app`), primera respuesta en horario (objetivo: 2 h hábiles en la beta) y qué incluye (ayuda para configurar; la carga de productos la hace el comercio, o se cotiza aparte). Dónde: un documento tuyo; después en la bio de WhatsApp, en el mensaje de ausencia y en la FAQ de la web (cambio de código).
- [ ] **9.2 Respuestas rápidas cargadas** ([`SOCIAL-KIT.md`](SOCIAL-KIT.md) §8). Dónde: WhatsApp Business.
- [ ] **9.3 Videos cortos por tarea** (cargar producto, configurar pagos, dibujar zona, compartir link): graba la pantalla, 60 a 90 s, sin editar. Sirven como respuesta de soporte y como contenido. Dónde: carpeta compartida o lista de YouTube no listada.
- [ ] **9.4 Registro de pedidos de funciones**: una planilla con la frase textual, quién y cuántas veces. Dónde: planilla.

## 10. Operación: backups, monitoreo y contingencia

- [ ] **10.1 Plan de Vercel apto para uso comercial** — el plan Hobby es para uso personal y no comercial según los términos de Vercel **[VERIFICAR el plan actual del team `nicoamicone1s-projects`]**. Dónde: Vercel → Settings → Billing.
- [ ] **10.2 Plan de Supabase con backups** — revisá qué incluye el plan actual del proyecto `asudscbvsrmulbpozjmq`: en el plan gratis los proyectos pueden pausarse por inactividad y los backups son limitados. Antes de tener datos de clientes, plan pago con backups diarios; evaluá Point in Time Recovery cuando haya ventas. Dónde: Supabase → Database → Backups y Billing.
- [ ] **10.3 Backup de las imágenes** — los backups de la base no incluyen los archivos de Storage (bucket `media`). Programá una copia periódica (por ejemplo semanal) a otro lugar. Dónde: Supabase Storage (API compatible con S3).
- [ ] **10.4 Prueba de restauración** una vez antes de lanzar: restaurá un backup en un proyecto aparte y abrí una tienda. Un backup que nunca se restauró no es un backup. Dónde: Supabase.
- [ ] **10.5 Monitoreo externo de disponibilidad** (servicio gratuito tipo UptimeRobot o Better Stack) sobre `https://www.ecommy.app/`, `https://demo.ecommy.app/` y `https://www.ecommy.app/planes`, con aviso a tu celular. Dónde: el servicio que elijas.
- [ ] **10.6 Cron diario**: revisá que corra (vence pruebas y reservas impagas). Dónde: Vercel → Settings → Cron Jobs y la prueba con `curl` de [`DEPLOY.md`](DEPLOY.md) §4.
- [ ] **10.7 Errores y logs**: mirá los errores de runtime una vez por día durante la beta. Dónde: Vercel → Logs / Observability; Supabase → Logs (Auth y Postgres).
- [ ] **10.8 Alertas de consumo**: límites de gasto en Vercel y alertas de uso en Supabase (base, almacenamiento, transferencia). Dónde: Vercel → Spend Management; Supabase → Usage.
- [ ] **10.9 Secretos**: `CRON_SECRET`, `RESEND_API_KEY` y, más adelante, `MP_ACCESS_TOKEN` marcados como *sensitive* y guardados en un gestor de contraseñas. Sin `DEV_LOGIN_*` en producción ([`DEPLOY.md`](DEPLOY.md) §1). Dónde: Vercel y tu gestor.
- [ ] **10.10 Plan de contingencia escrito** (una página):
  - Sitio caído: ver el estado de Vercel y de Supabase → si fue un deploy, "Promote to production" del anterior ([`DEPLOY.md`](DEPLOY.md) §7).
  - Datos rotos: restaurar backup o PITR; avisar a las tiendas afectadas.
  - Mails que no salen: revisar Resend y los logs de Auth; mientras tanto, alta asistida por WhatsApp.
  - WhatsApp bloqueado: número de respaldo → cambiar `PLATFORM_WHATSAPP`, bios y catálogo.
  - Clave filtrada: rotarla en el proveedor, actualizar Vercel y redeployar.
  - Mensaje a los comercios: texto en [`SOCIAL-KIT.md`](SOCIAL-KIT.md) §8 (respuesta `/incidente`).

## 11. Demo y landing

- [ ] **11.1 Permiso para la tienda demo** — el catálogo de `demo` se importó de la web de un proveedor (`data/products.json`). El propio importador avisa que textos e imágenes de terceros pueden tener derechos. Conseguí autorización por escrito o reemplazá el catálogo antes de mostrarla en público. Dónde: el proveedor; `npm run seed` con otro catálogo.
- [ ] **11.2 Demos por rubro**: al menos una de ropa (Atelier) y una de artesanías o deco (Mercado), con fotos propias o autorizadas. La demo actual le habla a la ferretería, no a la marca de ropa. Dónde: `/app/nueva` con tu cuenta.
- [ ] **11.3 Verificar la frase "En diez minutos tenés la tienda armada"** de la landing con una grabación cronometrada real. Si no se cumple con catálogo, cambiala por algo que sí (pedido de código). Dónde: `src/app/(platform)/page.tsx`.
- [ ] **11.4 Casos reales en la landing** sólo con autorización escrita ([`LAUNCH-PLAN.md`](LAUNCH-PLAN.md) §6.7). Dónde: pedido de código.
- [ ] **11.5 Superadmin**: tu cuenta con `is_platform_admin` y ninguna otra. Dónde: Supabase SQL ([`DEPLOY.md`](DEPLOY.md) §2).
