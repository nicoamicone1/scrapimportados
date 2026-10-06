# Pendientes del fundador (lo que necesita tus credenciales o tu cuenta)

> Fecha: 2026-10-06. Todo lo que no está acá ya quedó hecho en la rama `claude/loving-ptolemy-zthzxn`. Orden sugerido: bloqueantes primero. Nunca pegues valores de claves en este archivo ni en el chat; sólo marcá hecho.

## 0. Bloqueantes para que el código nuevo funcione en producción

| # | Qué | Dónde | Por qué | Estado |
| --- | --- | --- | --- | --- |
| 1 | Mergear la rama y deployar | GitHub → Vercel (proyecto `scrapimportados`) | Landing nueva, `/empezar`, checklist, planes y emails | ☐ |
| 2 | Aplicar la migración `supabase/migrations/0024_free_plan_moda.sql` | Supabase SQL Editor del proyecto `asudscbvsrmulbpozjmq` o `supabase db push` | Free pasa a 25 productos, remitos y Responder desde Starter. Sin esto el código tolera la diferencia pero `/planes` sigue mostrando 50 | ☐ |
| 3 | Regenerar tipos | `supabase gen types typescript` → `src/lib/supabase/database.types.ts` | Sólo si la migración agrega columnas (ver nota del agente de planes en el changelog) | ☐ |
| 4 | Agregar en Vercel `NEXT_PUBLIC_DEMO_STORE_SLUG=ropa` (production) | Vercel → Settings → Environment Variables | El CTA "Ver una tienda de ropa funcionando" apunta ahí. Hasta que exista la tienda `ropa`, dejá `demo` | ☐ |
| 5 | Sembrar la tienda demo de ropa | Terminal local con `.env.local` del proyecto: `SEED_EMAIL=… SEED_PASSWORD=… npx tsx scripts/seed-demo-ropa.mts` (ver `docs/DEMO-ROPA.md`) | Sin demo de ropa no hay CTA secundario ni video para los DMs | ☐ |
| 6 | Reemplazar las imágenes placeholder de la demo por fotos propias o con permiso | Panel de la tienda `ropa` → Productos | La demo se muestra en Puro Diseño el sábado | ☐ |

## 1. Medición (sin esto no se puede leer el funnel)

| # | Qué | Dónde | Estado |
| --- | --- | --- | --- |
| 7 | Crear propiedad GA4 "Ecommy sitio" y agregar `NEXT_PUBLIC_PLATFORM_GA4_ID=G-…` en Vercel (production). Hoy **no está** configurada: la landing no mide nada | analytics.google.com → Vercel env | ☐ |
| 8 | Marcar como conversiones en GA4: `sign_up`, `store_created` y la vista de `/empezar/gracias` (o el evento que emita la página de éxito del formulario) | GA4 → Admin → Eventos | ☐ |
| 9 | Guardar las 5 consultas SQL de `docs/LAUNCH-PLAN.md` §2.2 como snippets en el SQL Editor de Supabase. Se corren cada lunes | Supabase SQL Editor | ☐ |
| 10 | Crear la planilla semanal (Google Sheets) con las filas del scoreboard de `PLAN-GTM.md` §16 y una pestaña que importe `docs/gtm/prospectos.csv` | Google Sheets | ☐ |

## 2. Cuentas y canales de prospección

| # | Qué | Por qué | Estado |
| --- | --- | --- | --- |
| 11 | Decidir desde qué cuenta de Instagram mandás los DMs: la tuya personal (mejor tasa de respuesta, menos riesgo de bloqueo) o `@ecommy.app`. Recomendación: la personal, con "Hago Ecommy" en la bio y link a la demo de ropa | Las cuentas nuevas se bloquean tras unas docenas de DMs por día | ☐ |
| 12 | Interactuar 2 días (historias, comentarios) con los primeros 40 perfiles de `prospectos.csv` antes del primer DM | Evita caer en "Solicitudes" | ☐ |
| 13 | Entrada a Feria Puro Diseño (9 a 11 de octubre, La Rural) y 50 tarjetas con QR a `https://www.ecommy.app/empezar?utm_source=feria&utm_medium=qr&utm_campaign=purodiseno` | Es la fuente más concentrada de la semana 1 | ☐ |
| 14 | Grabar el video de 40 segundos: pedido de la demo de ropa llegando a tu WhatsApp con talle, color, total y dirección (pantalla del celular, sin editar) | Es el follow-up 1 de WhatsApp y el follow-up 2 de Instagram | ☐ |
| 15 | Cuenta gratuita en Apify (sin tarjeta, USD 5 de crédito) para la segunda tanda de prospectos (día 22) | Scrapea hashtags sin usar tu cuenta de IG | ☐ |
| 16 | Instalar Maps2Sheets en tu Google Sheets (gratis, 100 leads por día) | Búsquedas de showrooms por barrio | ☐ |

## 3. Oferta y cobro

| # | Qué | Dónde | Estado |
| --- | --- | --- | --- |
| 17 | Decidir y escribir en `/platform/planes` los precios anuales de Starter y Pro (12 por 10) si todavía no están cargados | `/platform` | ☐ |
| 18 | Confirmar que el cobro por transferencia del primer mes se registra a mano en `/platform/tiendas/<id>` y que el precio congelado 12 meses se anota en una nota interna de la tienda (no hay campo para eso: usá la nota de la suscripción o la planilla) | `/platform` | ☐ |
| 19 | Texto de la garantía en el chat de cierre: "Si en 30 días no te entró un pedido real por la tienda, te devuelvo el mes." Decidir si va también en `/empezar` (mi recomendación: sí, una línea) | `/empezar` | ☐ |
| 20 | Sacar captura con fecha de las páginas de comisiones de Pago Nube y de planes de Tiendanube antes de usar la comparación en público (`PLAN-GTM.md` §4) | Carpeta de evidencias | ☐ |

## 4. Lo que te voy a pedir durante los 30 días

- **Cada lunes:** los 5 números de las SQL + la planilla de prospectos actualizada. Con eso recalculo el funnel y te digo qué cambiar.
- **Después de cada demo:** la objeción textual que escuchaste. Una línea en la planilla alcanza.
- **Cuando entre el primer pedido real a una tienda de un prospecto:** avisame el slug. Armo el caso para la landing con tu captura y su permiso.
- **Si una tienda pasa a Free con más de 25 productos:** ese es el mejor momento para una llamada. Te preparo el mensaje con sus datos reales.

## Lo que ya quedó hecho y no requiere nada tuyo

- Plan completo: `docs/gtm/PLAN-GTM.md`.
- Mensajes para Instagram, WhatsApp, email y LinkedIn, con los 5 pasos y las variantes de apertura: `docs/gtm/MENSAJES.md`.
- Guion de demo de 10 minutos con discovery, objeciones y cierre: `docs/gtm/GUION-DEMO.md`.
- Lista inicial de prospectos y partners de ferias con fuente: `docs/gtm/prospectos.csv`, `docs/gtm/partners-ferias.csv`, `docs/gtm/fuentes.md`.
- Código: landing nueva, `/empezar`, checklist reordenado, Free a 25 con Responder y remitos desde Starter, email del día 3 "La prueba de fuego", emails de fin de prueba con datos reales, seed de la demo de ropa (ver `docs/CHANGELOG.md`, sección sin publicar).
