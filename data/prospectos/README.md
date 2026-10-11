# Prospectas: formato del JSON

Un archivo por prospecta (`data/prospectos/<slug>.json`), pensado para completarse en 5 minutos desde el celular mirando su Instagram o su lista de precios. Lo lee `scripts/prospect-store.mts`, que lo convierte al formato completo de `data/SCHEMA.md` y arma la tienda. Pasos del fundador: `docs/DEMO-PROSPECTA.md`.

- `_plantilla.json`: para copiar (`cp data/prospectos/_plantilla.json data/prospectos/<slug>.json`).
- `ejemplo-mycloset.json`: ejemplo completo con 12 productos **ficticios** (no son de la marca real), para probar el script.

```json
{
  "slug": "mycloset",
  "nombre": "My Closet",
  "instagram": "@my_closet.ar",
  "whatsapp": "5491122334455",
  "ciudad": "Buenos Aires",
  "rubro": "moda",
  "transferencia_descuento": 10,
  "retiro": { "nombre": "Showroom", "direccion": "", "horarios": "" },
  "productos": [
    { "nombre": "Remera oversize", "precio": 28000, "talles": ["S", "M", "L"], "colores": ["negro", "blanco"], "stock": 3 }
  ]
}
```

## Tienda

| Campo | Obligatorio | Qué es |
| --- | --- | --- |
| `slug` | Sí | La dirección: `mycloset` → `mycloset.<dominio>`. Minúsculas, números y guiones, de 3 a 40. No puede ser `demo`, `app`, `admin`, etc. |
| `nombre` | Sí | Nombre de la marca, como lo escribe ella |
| `whatsapp` | Sí | **El de ella** (ahí le llegan los pedidos), con código de país y área, sin 0 ni 15: `5491122334455`. Se aceptan espacios, `+` y guiones |
| `instagram` | No | `@usuario` o el link del perfil. Va al pie de la tienda |
| `ciudad` | No | Si es CABA («CABA», «Capital», «Buenos Aires», «Palermo, CABA»…) se crea el envío **CABA** ($ 4.500, 24 a 48 hs). Si es otra ciudad o queda vacía, un envío **«A coordinar por WhatsApp»** a todo el país |
| `rubro` | No | Default `moda` (preset Atelier). Otros: los de `src/lib/tenant/kinds.ts` |
| `transferencia_descuento` | No | % de descuento pagando por transferencia (0 a 50). Default 0 |
| `alias`, `titular`, `banco` | No | Datos para transferir. Sin alias, el pedido dice «Pedir los datos por WhatsApp» |
| `envio_costo` | No | Costo del envío si te lo dijo (pisa los $ 4.500 de CABA o los $ 0 de «A coordinar») |
| `retiro` | No | `{ "nombre", "direccion", "horarios" }`. Con `direccion` vacía no se crea retiro |

«Buenos Aires» a secas cuenta como CABA. Si es de provincia, poné la ciudad (`La Plata`, `Quilmes`…).

## Productos

Entre 10 y 15 (máximo 25, el límite de Free). Los más vendidos o los que más muestra en Instagram.

| Campo | Obligatorio | Qué es |
| --- | --- | --- |
| `nombre` | Sí | «Remera oversize». No repitas nombres: cada uno es la dirección de la ficha |
| `precio` | Sí | Entero en pesos: `28000` (también acepta `"28.000"` o `"$ 28.000"`) |
| `talles` | No | `["S", "M", "L"]` o `["36", "38", "40"]`. Las letras pasan a mayúscula |
| `colores` | No | `["negro", "blanco"]`. Cada color tiene su imagen de ejemplo y la ficha cambia de foto al elegirlo |
| `stock` | No | Unidades **por variante** (cada color × talle). Default 3. `0` = sin stock en todas (sirve para mostrar «Avisame cuando vuelva») |
| `categoria` | No | Si falta, se infiere del nombre (ver abajo) |
| `descripcion` | No | Texto corto de la ficha |
| `precio_antes` | No | Precio tachado (mayor que `precio`) |
| `destacado` | No | `true` para destacarlo |

Sin `talles` ni `colores` es un producto simple (una sola variante con `stock`). Con talles y colores se crea una variante por cada combinación (2 colores × 3 talles = 6 variantes, cada una con `stock`).

**Categoría inferida** (la primera palabra clave que aparece en el nombre gana; si no hay ninguna, «Catálogo»):

| Categoría | Palabras clave |
| --- | --- |
| Remeras | remera, remerón, musculosa, top, crop, body, polera, camiseta |
| Buzos | buzo, hoodie, canguro, sweater, cardigan, polar |
| Pantalones | pantalón, jean, jogger, calza, short, bermuda, palazzo, cargo, babucha, oxford |
| Vestidos | vestido, solero, enterito, mono |
| Polleras | pollera, falda, minifalda |
| Camisas | camisa, blusa, camisola |
| Camperas | campera, tapado, chaqueta, blazer, saco, chaleco, piloto, trench, parka, puffer, abrigo |
| Accesorios | accesorio, cartera, bolso, mochila, riñonera, cinto, cinturón, gorro, gorra, bufanda, pañuelo, medias, aros, collar, pulsera, anillo, lentes, billetera, scrunchie, vincha |

**Colores**: el hex de la imagen de ejemplo sale del mapa de la demo de ropa (`swatches` de `data/demo-ropa.json`) y de una lista de colores comunes del script (rojo, beige, nude, camel, suela, jean, salvia, lila…). «Verde oliva claro» usa el de «verde oliva»; uno desconocido recibe un tono suave y el `--dry-run` lo avisa. Da igual: la imagen se reemplaza por su foto.

## Reglas

- Campos que el script no conoce (un typo como `"talle"` por `"talles"`) frenan con un error. Los que empiezan con `_` (`"_nota"`) son comentarios y se ignoran.
- Re-correrlo es seguro: actualiza nombre, precio y opciones, y **no pisa el stock ni las fotos** que ya tenga un producto. Sumar productos al JSON y volver a correrlo los agrega.
- Cada producto se identifica por su nombre: si lo cambiás en el JSON, se crea otro producto (borrá el viejo desde el panel).
