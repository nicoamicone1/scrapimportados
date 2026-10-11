# Contrato data/products.json

```json
{
  "scrapedAt": "2026-08-19T18:00:00.000Z",
  "source": "https://dazimportadora.com.ar",
  "markup": 0.2,
  "pricing": { "webSurcharge": 0.15, "markup": 0.2, "cashDiscount": 0.1 },
  "currency": "ARS",
  "count": 694,
  "categories": [ { "id": 128, "name": "Hogar", "slug": "hogar", "parent": 0 } ],
  "products": [
    {
      "id": 128944,
      "sku": "01060769",
      "name": "Panchuquera Electrica 750W ...",
      "slug": "panchuquera-electrica-...",
      "permalink": "https://dazimportadora.com.ar/producto/...",
      "image": "https://dazimportadora.com.ar/wp-content/uploads/....png",
      "images": ["..."],
      "categories": [ { "id": 130, "name": "Cocina", "slug": "cocina" } ],
      "inStock": true,
      "onSale": false,
      "type": "simple",
      "shortDescription": "texto plano sin html",
      "prices": {
        "efectivo": { "base": 29900, "final": 37135 },
        "web":      { "base": 34385, "final": 41262 }
      },
      "supplierWebPrice": 31993
    }
  ]
}
```

- Todos los precios son enteros en ARS (sin centavos).
- `lista` = `prices.price` de la Store API (precio de lista del proveedor; número, ojo `currency_minor_unit`).
- `prices.web.base`  = `round(lista * (1 + webSurcharge))`  → costo real comprando por la web (default +15%).
- `prices.web.final` = `round(lista * (1 + webSurcharge) * (1 + markup))` → precio de venta web (default +20% de ganancia).
- `prices.efectivo.base`  = `lista`.
- `prices.efectivo.final` = `round(web.final * (1 - cashDiscount))` → precio efectivo (default -10%).
- `supplierWebPrice` = el "Precio web" que publica el proveedor (solo referencia, no se usa).
- El payload incluye `pricing: { webSurcharge, markup, cashDiscount }`.
- Productos variables: usar `price_range.min_amount` como base si `price` no sirve; el front muestra "desde".

## Campos opcionales: catálogo propio con talles y colores

`scripts/seed-from-json.mts` acepta, además del formato DAZ, productos con variantes propias (lo usa `data/demo-ropa.json`, ver `docs/DEMO-ROPA.md`). Todo es opcional y retrocompatible: un producto sin `variants` se importa como siempre (una variante "Default" con `prices.web.final`).

```json
{
  "source": "demo:luna-indumentaria",
  "swatches": { "Negro": "#1B1A18", "Arena": "#D8C7A8" },
  "store": { "...": "sólo lo lee scripts/seed-demo-ropa.mts" },
  "categories": [ { "id": 1, "name": "Remeras", "slug": "remeras", "parent": 0 } ],
  "products": [
    {
      "id": 1001,
      "sku": "LU-RE01",
      "name": "Remera básica de algodón",
      "slug": "remera-basica-de-algodon",
      "images": [],
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

- `price` (venta), `compareAt` (precio tachado, mayor a `price`) y `cost` pisan a `prices`; cada variante puede traer su propio `price` y `compareAt`.
- `variants[].options` tiene una entrada por cada opción del producto, con valores de `options[].values`. El seed valida cada producto con el mismo schema del panel (`productSchema`): combinaciones, SKUs y tramos inválidos frenan la importación.
- `priceTiers`: precios por cantidad (migración 0021 y plan con `pricing.tiers`); si la base los rechaza, el producto se importa sin tramos y se avisa.
- `swatches`: color (valor de la opción "Color") → hex. Con `--placeholders`, cada producto sin `images` recibe una imagen de ejemplo SVG por color, y cada variante muestra la de su color.
- Re-importar no pisa el stock de variantes existentes ni sus imágenes.
- `scripts/prospect-store.mts` genera este formato (más el bloque `store`) a partir de un JSON mínimo de prospecta: `data/prospectos/README.md`.
