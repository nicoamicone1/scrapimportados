# Tienda de una prospecta en 20 minutos

> Para cuando una prospecta contesta que sí a «te armo tu tienda con 10 o 15 productos tuyos, sin costo, para que lo veas con tu catálogo». Sale de una lista corta (nombre, precio, talles, colores) que sacás de su Instagram o de su lista de precios.
> Es la versión corta de «Antes de la llamada» de `docs/gtm/GUION-DEMO.md`: 10 a 15 productos en vez de 30, y el script hace el alta y la configuración.

Archivos: `data/prospectos/_plantilla.json` (para copiar), `data/prospectos/README.md` (el formato, campo por campo), `data/prospectos/ejemplo-mycloset.json` (ejemplo con productos ficticios) y `scripts/prospect-store.mts`. El script usa lo mismo que la demo de ropa (`docs/DEMO-ROPA.md`): `scripts/lib/store-setup.mts` para la tienda y `scripts/seed-from-json.mts` para el catálogo.

## Una sola vez

1. `.env.local` en la raíz con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_ROOT_DOMAIN` (para que los links salgan con el dominio real). No hace falta la service-role key.
2. Tu cuenta de **admin de plataforma** (`SEED_EMAIL` / `SEED_PASSWORD`): puede tener más de 3 tiendas y el script deja cada una en Pro activo, así no vence a los 14 días mientras ella decide.
3. Probá el ejemplo en seco: `npx tsx scripts/prospect-store.mts data/prospectos/ejemplo-mycloset.json --dry-run`.

## Por cada prospecta (20 minutos)

| Min | Paso |
| --- | --- |
| 0 a 1 | 1. Copiar la plantilla |
| 1 a 6 | 2. Completar 10 a 15 productos desde su perfil |
| 6 a 7 | 3. `--dry-run` |
| 7 a 9 | 4. Crear la tienda |
| 9 a 12 | 5. Reemplazar las fotos |
| 12 a 15 | 6. Pedido de prueba y revisión en el celular |
| 15 a 16 | 7. Mandarle el mensaje |
| Después | 8. Pasarle la tienda |

### 1. Copiar la plantilla

```bash
cp data/prospectos/_plantilla.json data/prospectos/<slug>.json
```

El `slug` es la dirección (`mycloset` → `mycloset.<dominio>`): el usuario de Instagram sin puntos ni guiones bajos suele andar. Si es una palabra reservada (`demo`, `app`, `admin`…) o ya está en uso, el script avisa.

### 2. Completar los productos (5 minutos, desde su perfil)

Con su Instagram abierto en el celular:

- **Datos de la tienda.** `nombre` como lo escribe ella, `instagram`, `whatsapp` (el botón de WhatsApp de su perfil o el de la bio; con 549 + área + número), `ciudad` y el descuento por transferencia si lo publica («10 % off transferencia»). Si tiene showroom, `retiro.direccion`; si no, dejala vacía.
- **Productos.** Los fijados, las historias destacadas de «Precios», «Nuevo» o «Talles», o la lista de precios si te la pasó. Elegí 10 a 15: los más vendidos o los que más repite. De cada uno, `nombre`, `precio`, `talles` y `colores` (los colores del carrusel, en palabras simples: «negro», «verde oliva»).
- **Stock.** No lo cargues: queda 3 por variante. Si preguntaste «¿cuántas de cada talle tenés de la remera X?», poné ese número en `stock` para que la demo sea real.
- **Categoría.** No hace falta: sale del nombre (remera, buzo, pantalón, vestido, camisa, campera, accesorio…). Ponela sólo si no la adivina (el `--dry-run` muestra cuáles quedaron en «Catálogo»).

Formato completo y ejemplos: `data/prospectos/README.md`.

### 3. En seco (1 minuto)

```bash
npx tsx scripts/prospect-store.mts data/prospectos/<slug>.json --dry-run
```

No se conecta a la base ni pide credenciales. Valida el JSON con los mismos schemas del panel y lista todo: la categoría de cada producto (inferida o no), las variantes, el color de cada imagen de ejemplo, la configuración y el mensaje que le vas a mandar. Mirá el bloque **«Revisá:»**: WhatsApp de ejemplo o sin 549, sin alias, envío «A coordinar» a $ 0 (en el checkout se ve «Gratis»: si sabés cuánto cobra, poné `envio_costo`), colores sin hex conocido. Si hay errores (un typo como `"talle"`, un precio en 0, dos productos con el mismo nombre), te dice cuál y en qué producto.

### 4. Crear la tienda (2 minutos)

```bash
SEED_EMAIL=tu-mail SEED_PASSWORD='tu-clave' npx tsx scripts/prospect-store.mts data/prospectos/<slug>.json
```

| Variable | Qué es |
| --- | --- |
| `SEED_EMAIL` | Tu cuenta de admin de plataforma (queda como dueña de la tienda hasta que se la pases) |
| `SEED_PASSWORD` | Su contraseña. No la guardes en archivos del repo |

Qué hace:

- Crea la tienda `slug` con el alta de siempre (`create_store()`, rubro moda → preset **Atelier**), o usa la que ya existe si sos dueño o admin.
- WhatsApp **de ella** (ahí le llegan los pedidos), transferencia con su descuento y «Acordar con el vendedor», su Instagram en el pie.
- Envío **CABA** ($ 4.500, 24 a 48 hs) si es de CABA; si no, **«A coordinar por WhatsApp»** a todo el país. Retiro si cargaste la dirección.
- «Quedan pocas» desde 2: con 3 por variante no dice «quedan 3» en todo; después del pedido de prueba, esa variante dice «Quedan 2».
- Productos con sus variantes color × talle e imágenes de ejemplo por color (SVG: color, nombre y «Foto de ejemplo»).
- Pro activo (manual, sin cobro) porque sos admin de plataforma.

Al final imprime la **URL de la tienda**, una ficha para probar, el **link del panel** (`/app` → la tienda) y el bloque **«Mensaje para mandarle»**.

Es idempotente: si te faltó un producto, sumalo al JSON y volvé a correrlo. No pisa el stock ni las fotos de lo que ya está.

### 5. Reemplazar las fotos (3 minutos)

Guardá en el celular una foto por color de los productos que más se ven (los primeros 4 a 6 del catálogo, los que aparecen en el inicio). Desde el panel en el celular:

1. Productos → el producto → **Imágenes**: subí su foto y borrá la de ejemplo.
2. En **Variantes**, asigná a cada color su foto (la ficha cambia de foto al elegir el color).

Las que no llegues a cambiar quedan con «Foto de ejemplo»: está bien para que la vea ella, y lo terminás después o lo hace ella. Son fotos de su marca para su propia tienda: no uses ese link para mostrarle Ecommy a nadie más. No corras `--force-images`: borra también las fotos que subiste.

### 6. Pedido de prueba y revisión (3 minutos)

En el celular, en el orden del guion (`docs/gtm/GUION-DEMO.md`):

1. Abrí la ficha que imprimió el script → elegí color y talle → agregá al carrito → «Iniciar compra» → datos de prueba → **Transferencia** (se ve el descuento) → confirmar.
2. En la página del pedido tocá «Enviar comprobante por WhatsApp» (o «Pedir los datos por WhatsApp» si no cargaste alias): se abre el chat **con ella** con el pedido armado. **No lo mandes**: sólo verificá que se arma bien y cerrá.
3. Panel → Hoy: «1 por confirmar». Cancelá el pedido de prueba: el stock vuelve solo.

### 7. Mandarle el mensaje (1 minuto)

Copiá el bloque «Mensaje para mandarle» de la salida del script y mandáselo por el mismo DM:

> listo! te armé la tienda con 12 productos para que la veas funcionando: https://mycloset.ecommy.app. entrá desde el celu, elegí un talle y fijate como te llega el pedido al whatsapp. después te paso el acceso al panel asi la seguís vos

Si cambiaste fotos o productos hace menos de 5 minutos, esperá antes de mandarlo (caché de la tienda).

### 8. Pasarle la tienda

Cuando quiera seguirla ella («Pasar la tienda a otra persona», desde v0.11.0; artículo de ayuda `/ayuda/pasar-la-tienda`):

1. **Antes, el plan.** El script la dejó en Pro activo manual, y el plan viaja con la tienda: si la pasás así, ella queda con Pro sin vencimiento. Si querés que arranque con la prueba, desde `/platform` poné la tienda en **Free**: la primera vez que una tienda cambia de dueño, si nunca se pagó un plan, quien la recibe arranca **14 días de Pro gratis**.
2. Panel → **Usuarios** → abajo de todo, **Pasar la tienda**. Escribí el email de ella y elegí si seguís como administrador (para ayudarla los primeros días) o salís del equipo. Antes de confirmar ves la lista de lo que pasa.
3. Como ella no está en el equipo, le llega un mail con un link que **vence en 7 días**. Copiá el link y mandáselo también por WhatsApp. Hasta que lo acepte, la tienda sigue a tu nombre (podés anularlo).
4. Ella abre el link con **ese mismo email** (o crea su cuenta con él) y toca **Recibir la tienda y entrar al panel**. Queda a su nombre con todo lo cargado: productos, fotos, estilo y pedidos.
5. Que revise lo primero: cómo cobra (alias y titular para la transferencia; Mercado Pago lo conecta ella en Configuración › Pagos), el WhatsApp y el email de contacto (ahí le llegan los avisos de pedidos), y quién más está en Usuarios.

Queda registrado en Auditoría. Para volver atrás, ella te la tiene que pasar de nuevo. Si ya tiene tres tiendas a su nombre, no puede aceptarla.
