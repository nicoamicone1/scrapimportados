# Formato del catálogo JSON de los seeds

Lo lee `scripts/seed-from-json.mts` (módulo de `scripts/seed-demo-ropa.mts` y `scripts/prospect-store.mts`). Ejemplo completo: `data/demo-ropa.json` (la tienda demo, ver `docs/DEMO-ROPA.md`). `scripts/prospect-store.mts` genera este mismo formato a partir de un JSON mínimo de prospecta (`data/prospectos/README.md`).

```json
{
  "scrapedAt": "2026-10-06T00:00:00.000Z",
  "source": "demo:luna-indumentaria",
  "swatches": { "Negro": "#1B1A18", "Arena": "#D8C7A8", "default": "#D9D4CC" },
  "store": { "...": "configuración de la tienda: la lee scripts/seed-demo-ropa.mts" },
  "categories": [ { "id": 1, "name": "Remeras", "slug": "remeras", "parent": 0 } ],
  "products": [
    {
      "id": 1001,
      "sku": "LU-RE01",
      "name": "Remera básica de algodón",
      "slug": "remera-basica-de-algodon",
      "categories": [ { "id": 1, "name": "Remeras", "slug": "remeras" } ],
      "shortDescription": "texto plano",
      "price": 26000,
      "compareAt": 30000,
      "cost": 10900,
      "featured": true,
      "tags": ["basicos"],
      "priceTiers": [ { "min_qty": 3, "price": 23500 } ],
      "options": [ { "name": "Color", "values": ["Negro", "Arena"] }, { "name": "Talle", "values": ["S", "M"] } ],
      "variants": [ { "options": { "Color": "Negro", "Talle": "M" }, "sku": "LU-RE01-NEG-M", "stock": 2 } ]
    }
  ]
}
```

- Precios enteros en ARS (sin centavos). `price` es el de venta de cada variante, salvo que la variante traiga el suyo; `compareAt` (precio tachado, mayor a `price`) y `cost` son opcionales.
- `id` (producto y categoría) es estable: el seed actualiza por `id` (`external_id` en la base), así que re-importar no duplica. `source` va en `products.metadata.importedFrom`.
- `variants` es obligatorio: una por combinación, con `options` (una entrada por cada opción del producto, con valores de `options[].values`), `stock` y, opcional, `sku`, `price` y `compareAt`. Un producto sin talles ni colores es `"options": []` y una sola variante con `"options": {}`. El seed valida cada producto con el mismo schema del panel (`productSchema`): combinaciones, SKUs y tramos inválidos frenan la importación.
- `sku` del producto es una referencia del archivo (no se guarda: el SKU es de cada variante).
- `priceTiers`: precios por cantidad (migración 0021 y plan con `pricing.tiers`); si la base los rechaza, el producto se importa sin tramos y se avisa.
- `categories[].parent`: `id` de la categoría madre (0 = raíz).
- Imágenes: el seed sube una imagen de ejemplo SVG por color (la de `swatches[color]`, o `swatches.default`) y cada variante muestra la de su color; un producto sin colores recibe una. Las fotos reales se suben desde el panel (`images` en el JSON tiene que ir vacío o no estar).
- Re-importar no pisa el stock de variantes existentes ni sus imágenes (salvo `--force-images`).
