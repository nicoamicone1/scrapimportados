# scripts/

Corren desde la raíz del repo con `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y, para los links, `NEXT_PUBLIC_ROOT_DOMAIN`). Ninguno usa la service-role key: entran con `SEED_EMAIL` / `SEED_PASSWORD` y pasan por RLS como ese usuario.

| Script | Qué hace | Doc |
| --- | --- | --- |
| `seed-demo-ropa.mts` (`npm run seed`) | La tienda demo pública `demo` («Luna Indumentaria», ropa con talle × color) desde `data/demo-ropa.json`. `--dry-run` no escribe; `--replace` borra el catálogo que tenga la tienda antes de sembrar | `docs/DEMO-ROPA.md` |
| `prospect-store.mts <json>` | La tienda de una prospecta desde un JSON mínimo (`data/prospectos/<slug>.json`) | `docs/DEMO-PROSPECTA.md` |
| `seed-from-json.mts` | Módulo (no se corre solo): valida un catálogo con los schemas del panel y lo siembra con imágenes de ejemplo. Lo usan los dos de arriba | `data/SCHEMA.md` |
| `lib/store-setup.mts` | Módulo: alta (`create_store`) y configuración de la tienda desde el bloque `store` del JSON, y Pro activo | |
| `lib/store-replace.mts` | Módulo: el `--replace` de la demo (inspección de sólo lectura, borrado del catálogo y del bucket, identidad de tienda nueva) | `docs/DEMO-ROPA.md` |
| `lib/placeholder-svg.mts` | Módulo: imagen de ejemplo SVG por color | |
| `lib/garment-svg.mts` | Módulo: ilustración de moda SVG por producto × color (prenda reconocida por el nombre, textura según el tejido, luna de fondo). La usa `seed-from-json.mts` cuando el JSON trae `"imageStyle": "illustrated"` en la raíz; si la prenda no se reconoce, cae al placeholder. | |
| `build-luna-art.mts` | Regenera el arte de campaña de la demo Luna (`public/demo/luna/*.svg`: logo, favicon, hero, lookbook, taller, banners e imágenes de categoría) a partir de `lib/garment-svg.mts` | `node node_modules/tsx/dist/cli.mjs scripts/build-luna-art.mts` |
| `create-admin.mts` (`npm run create-admin`) | Alta de un usuario con `signUp` (la tienda se crea en `/app/nueva`) | `docs/DEV-ACCESS.md` |
| `move-media-to-store.mts [slug]` | Mueve objetos sueltos del bucket `media` a `<store_id>/…` (migración 0011) | |
| `landing-shots.cjs`, `shots.cjs` | Capturas de pantalla para la landing y para revisar pantallas | encabezado de cada archivo |

Para importar el catálogo de un comercio desde su web o un CSV está el importador del panel (`/admin/importar`, código en `src/lib/scraper`), no un script.
