# scrape.mjs

Scrapea el catalogo de dazimportadora.com.ar via la WooCommerce Store API publica (Node puro, sin dependencias) y escribe `data/products.json` segun el contrato de `data/SCHEMA.md`.

- Ejecutar: `npm run scrape` o `node scripts/scrape.mjs` (tarda ~25s: 7 paginas de productos + 1 de categorias, secuenciales con 700ms de pausa y 3 reintentos con backoff).
- Markup configurable (default `0.2`): `node scripts/scrape.mjs --markup=0.35` o `MARKUP=0.35 npm run scrape`. El flag CLI tiene prioridad sobre la variable de entorno; `final = round(base * (1 + markup))`.
- Salida alternativa: `--out=ruta/archivo.json` (por defecto `data/products.json`, JSON prolijo en UTF-8, productos ordenados por nombre).
- El progreso y el resumen final (cantidad de productos, categorias y cuantos quedaron sin precio web) se loguean a stderr, asi que el stdout queda limpio.
