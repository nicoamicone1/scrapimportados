# Demo de ropa: Luna Indumentaria

> Tienda demo para mostrarle Ecommy a marcas de ropa (PLAN-GTM §9). La demo vieja (`demo`, electro y bazar de DAZ) no sirve para eso: una marca de ropa necesita ver **talles, colores y stock por variante**.
> «Luna Indumentaria» es una marca **ficticia**: los nombres, precios, alias y dirección son de ejemplo. No la uses para cobrarle a nadie.

## Qué crea

| | |
| --- | --- |
| Tienda | `ropa` («Luna Indumentaria»), rubro moda, preset **Atelier** (Cormorant sobre blanco roto, tarjetas 4:5) |
| Catálogo | 30 productos en 6 categorías: Remeras (6), Buzos y camperas (6), Pantalones (6), Vestidos (5), Camisas (4), Accesorios (3) |
| Variantes | 244 variantes **color × talle** (S a XL, S a L o 36 a 44; accesorios por color), stock de 0 a 8 por variante: 46 agotadas y 32 con 2 unidades |
| Para mostrar | «Quedan 2» en **Remera básica de algodón, Negro / M** · precio tachado en 6 productos · **precio por cantidad** en 3 (Remera básica: 3+ a $ 23.500 y 6+ a $ 21.900; Musculosa acanalada: 3+ a $ 21.500; Medias por 3 pares: 3+ a $ 10.500) · **Tapado de paño largo sin stock** en todas sus variantes, para mostrar «¿Querés que te avisemos cuando vuelva?» |
| Cobro | Transferencia con **10 %** de descuento (alias `ALIAS.DE.EJEMPLO`, titular de ejemplo) y «Acordar con el vendedor» por WhatsApp |
| Entrega | Envío **CABA** $ 4.500 (gratis desde $ 120.000, 24 a 48 hs hábiles) y **retiro en el local** («Local de Palermo», dirección de ejemplo) |
| Stock | Aviso de «quedan pocas» desde 3 unidades por variante |
| Imágenes | Una imagen de ejemplo por color (SVG: plano del color, nombre, color, talles y «Foto de ejemplo»). Al elegir un color, la ficha muestra la suya |
| Plan | Pro activo si corrés el script con un admin de plataforma; si no, los 14 días de Pro del alta |

Archivos: `data/demo-ropa.json` (catálogo + bloque `store` con la configuración), `scripts/seed-demo-ropa.mts` (tienda y configuración, con `scripts/lib/store-setup.mts`, que comparte con la tienda de prospectas) que usa `scripts/seed-from-json.mts` (catálogo, el mismo seed de siempre) y `scripts/lib/placeholder-svg.mts` (imágenes de ejemplo).

## Antes de empezar

1. `.env.local` en la raíz con las variables del proyecto que ya usa la app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y, para que el script imprima el link correcto, `NEXT_PUBLIC_ROOT_DOMAIN`. El script no usa la service-role key.
2. Una cuenta con el mail confirmado. Conviene la tuya de **admin de plataforma**: puede crear más de 3 tiendas y el script deja la demo en Pro activo (si no, a los 14 días pasa a Free: 25 productos y sin Responder).
3. Migraciones aplicadas hasta la 0021 como mínimo (precios por cantidad; sin ella los productos se cargan igual, sin tramos, y el script avisa). La 0016 es la de «Avisame cuando vuelva».
4. Tu WhatsApp en formato internacional sin `+`, sin 0 y sin 15 (ej. `5491122334455`): es adonde llegan los pedidos de la demo. Sin `SEED_WHATSAPP` queda el placeholder `5491100000000` y el paso 4 de abajo no te llega a vos.

## Comando

Primero en seco (valida el JSON con los mismos schemas del panel y lista todo lo que crearía, sin conectarse a la base ni pedir credenciales):

```bash
npx tsx scripts/seed-demo-ropa.mts --dry-run
```

Después, de verdad:

```bash
SEED_EMAIL=tu-mail SEED_PASSWORD='tu-clave' SEED_WHATSAPP=549XXXXXXXXXX npx tsx scripts/seed-demo-ropa.mts
```

| Variable | Obligatoria | Qué es |
| --- | --- | --- |
| `SEED_EMAIL` | Sí | Mail de la cuenta que va a ser dueña de la tienda (o admin, si ya existe) |
| `SEED_PASSWORD` | Sí | Su contraseña. No la guardes en archivos del repo |
| `SEED_WHATSAPP` | Recomendada | Tu WhatsApp para recibir los pedidos de la demo |
| `SEED_STORE` | No | Otro slug (default `ropa`) |
| `SEED_FILE` | No | Otro catálogo con el mismo formato (default `data/demo-ropa.json`) |

Flags: `--dry-run` (no toca nada), `--force-images` (borra **todas** las imágenes de los 30 productos, incluidas fotos que hayas subido, y vuelve a generar las de ejemplo).

Es idempotente: si la tienda existe la usa (y vuelve a aplicar preset, transferencia, envío y retiro); los productos se actualizan por su id del JSON, el **stock de las variantes existentes no se pisa** y las imágenes que ya tenga un producto tampoco. Para ver los cambios puede tardar hasta 5 minutos (caché de la tienda).

Al terminar imprime el link de la tienda y el de la ficha para la demo. Con subdominios es `https://ropa.<dominio>`; en modo sin subdominios, `https://<dominio>/s/ropa`.

## Qué verificar en el celular

Hacelo una vez antes de cada demo, en el orden del guion (PLAN-GTM §9, GUION-DEMO).

1. **Tienda.** Abrí el link: fondo blanco roto, títulos en Cormorant, logo al centro y la banda «10 % de descuento pagando por transferencia». En el catálogo, las tarjetas muestran el precio por transferencia y el Tapado aparece al final, sin stock.
2. **Ficha con talles y «quedan 2».** Remera básica de algodón → Color **Negro** → Talle **M**: dice «Quedan 2» y la imagen pasa a la negra. Probá **Negro / L**: «Negro / L sin stock», el formulario «¿Querés que te avisemos cuando vuelva?» y «Consultar por WhatsApp». Más abajo, la tabla de precio por cantidad (desde 3 unidades).
3. **«Avisame cuando vuelva».** Tapado de paño largo: «Sin stock» en todos los talles y el formulario de aviso. Dejá un mail y fijate que aparece en el panel, Inventario → Avisos.
4. **Checkout por transferencia.** Agregá Negro / M al carrito → «Iniciar compra» → datos de prueba con dirección en CABA (envío $ 4.500) o retiro en el local («Retirás en Local de Palermo») → **Transferencia bancaria** (se ve el 10 % de descuento) → confirmar.
5. **Pedido llegando a WhatsApp.** En la página del pedido tocá «Enviar comprobante por WhatsApp»: se abre el chat con el número de `SEED_WHATSAPP` con el pedido armado (número, ítems con color y talle, total, entrega). Hacelo desde otro celular para que se vea como llega; desde el tuyo, WhatsApp lo abre en el chat con vos mismo.
6. **Hoy con «1 por confirmar».** Entrá al panel con `SEED_EMAIL`, tienda Luna Indumentaria: en Hoy aparece «1 por confirmar» con «Confirmar pago». En Inventario, Remera básica Negro / M bajó de 2 a 1.
7. **Responder con «¿tenés la negra en M?».** Panel → Responder → buscá **«remera básica»** (busca por nombre o SKU, no por color: «negra» sola no encuentra nada) → elegí Negro / M → copiá la respuesta con precio, stock y link.

**Después de la demo:** cancelá el pedido de prueba desde el panel; el stock vuelve solo. Si dejaste pasar las 48 horas, se cancela solo.

## Landing apuntando a esta demo

La landing toma la tienda demo de `NEXT_PUBLIC_DEMO_STORE_SLUG` (la está sumando otro cambio de esta rama; default `demo`). Cuando la tienda `ropa` ya esté sembrada y verificada, en Vercel → Settings → Environment Variables (production) poné `NEXT_PUBLIC_DEMO_STORE_SLUG=ropa` y volvé a deployar. Hasta entonces dejala en `demo`.

## Reemplazar las imágenes de ejemplo

Las imágenes dicen «Foto de ejemplo» a propósito. Para mostrarla en público:

1. Panel → Productos → el producto → Imágenes: subí fotos propias o con permiso (nunca de otra marca) y borrá las de ejemplo.
2. En la tabla de variantes, asigná a cada color su foto (la ficha cambia de foto al elegir el color).
3. No corras `--force-images` después: borra también las fotos que subiste.

Para la demo con un prospecto (PLAN-GTM §9) no uses esta tienda: cargá su catálogo con sus fotos en una tienda a su nombre (`docs/DEMO-PROSPECTA.md`: 10 a 15 productos en 20 minutos con `scripts/prospect-store.mts`). Luna sirve para la landing, los videos y la primera conversación.
