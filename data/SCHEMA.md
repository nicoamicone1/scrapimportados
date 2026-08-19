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
