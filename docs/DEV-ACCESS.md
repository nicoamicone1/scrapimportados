# Acceso de desarrollo

> **Sólo para desarrollo.** Antes de usar este proyecto en producción cambiá la
> contraseña de este usuario (es superadmin de la plataforma y dueño de la tienda demo).

## Usuario admin de prueba

| Campo | Valor |
| --- | --- |
| URL | `http://localhost:3000/login` (o el puerto de tu dev server) |
| Email | `admin@ecommy.local` |
| Contraseña | `Ecommy-2026!` |
| Rol | dueño (`owner`) de la tienda `demo` + `profiles.is_platform_admin = true` (entra a `/platform`) |

Tiendas de QA (base de desarrollo): `demo` ("Ecommy Demo", plan Pro activo,
`/s/demo/`) y `taller-luna` ("Taller Luna", rubro artesanías → preset `mercado`, trial
Pro de 14 días, `/s/taller-luna/`), ambas del usuario de arriba.

Proyecto Supabase: `asudscbvsrmulbpozjmq`.

## Demos de clientes

Tiendas armadas con el catálogo y la marca de un cliente potencial, para mostrarle
Ecommy funcionando con sus productos. Cada una tiene su usuario dueño; el equipo
(`nicoamicone1@gmail.com`) queda como admin para verla en "Mis tiendas".

| Tienda | Cliente | Origen | Dueño |
| --- | --- | --- | --- |
| `nextbooks` | NextBooks (libros, Tucumán) | — | `nicoamicone1@gmail.com` |
| `daenvases` | DA Envases (descartables, Tucumán) | — | `nicoamicone1@gmail.com` |
| `ramas` | RAMA´S (impresión 3D, Yerba Buena, Tucumán) | Tiendanube `ramas3.mitiendanube.com` | `nicoamicone1+ramas@gmail.com` (cuenta demo para el cliente) |

La contraseña de cada cuenta demo NO va en el repo: se le pasa al cliente por privado.

### Cómo se arma una demo desde Tiendanube (ej. `ramas`)

1. **Scrape** (HTML público, sin credenciales):
   `node scripts/scrape-tiendanube.mjs --url=https://<tienda>.mitiendanube.com --out=data/clients/<cliente>.json`
   → productos con variantes y precios del cliente (el de transferencia sale del
   descuento que muestra la tienda), descripción HTML, fotos del CDN, categorías
   del menú, logo, WhatsApp e Instagram, y `featured` para lo que destaca en su home.
2. **Cuenta demo**: `ADMIN_EMAIL=<alias>+<cliente>@gmail.com ADMIN_PASSWORD=… npm run create-admin`.
   El proyecto exige confirmar el email: se confirmó por SQL (migración de datos
   `demo_<cliente>_cuenta`).
3. **Tienda**: logueado con esa cuenta, `rpc('create_store', { p_name, p_slug, p_kind, p_whatsapp, p_options })`
   (queda dueño, trial Pro de 14 días).
4. **Catálogo**: `SEED_EMAIL=… SEED_PASSWORD=… SEED_STORE=<slug> SEED_FILE=data/clients/<cliente>.json npx tsx scripts/seed-tiendanube.mts`
   (sube fotos y logo al bucket, crea sólo las categorías con productos).
5. **Marca**: tema, textos, home, menús, envíos y datos de transferencia de ejemplo
   en migraciones de datos `demo_<cliente>_*` (herramienta MCP `apply_migration`,
   NO están en `supabase/migrations/`), igual que `demo_nextbooks_*`.

Para `ramas`: migraciones `demo_ramas_cuenta`, `demo_ramas_marca` (tema negro y
amarillo `#F1C40F`, Unbounded + Figtree, home de 12 bloques, 15 % por transferencia,
zonas de envío y CBU **de ejemplo**, categoría Harry Potter), `demo_ramas_ajustes` y
`demo_ramas_descripciones`. Hero, favicon e imagen para compartir en
`media/<store_id>/brand/` (armados con fotos de sus productos y su logo).

## Cómo se creó

1. Primero se intentó el alta normal con `signUp` (`npm run create-admin`, ver
   `scripts/create-admin.mts`). Supabase Auth rechaza el dominio `.local`
   ("Email address is invalid"), así que se usó el plan B:
2. Alta directa por SQL (herramienta MCP `apply_migration`, migración de datos
   `dev_seed_admin_user`, NO está en `supabase/migrations/`): insert en
   `auth.users` con `crypt(password, gen_salt('bf'))`, `email_confirmed_at = now()`,
   `raw_app_meta_data = {"provider":"email","providers":["email"]}`,
   `aud/role = 'authenticated'`, más la fila en `auth.identities`
   (`provider = 'email'`, `provider_id = email`, `identity_data = {sub, email}`).
3. El trigger `on_auth_user_created` creó el perfil. Desde la 0011 los roles son por
   tienda (`store_members`): la migración lo dejó dueño de `demo` y superadmin.
4. Se verificó el login con `signInWithPassword` y en el navegador.

## Otros usuarios

- Registro normal en `/registro` con un email de dominio válido (Supabase rechaza
  `.local` y dominios inventados; para QA usá alias de Gmail, ej.
  `tu.cuenta+qa1@gmail.com`). Después `/app/nueva` crea la tienda.
- `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin` crea sólo el usuario.
- Si el proyecto exige confirmar email, `signUp` crea el usuario sin sesión:
  confirmalo desde el mail o por SQL:
  `update auth.users set email_confirmed_at = now() where email = '…';`
- Para sumar a alguien a una tienda: `/admin/usuarios` → Invitar (si ya tiene cuenta
  entra directo; si no, se genera un link `/invitacion/<token>`).

## Seed del catálogo

```bash
SEED_EMAIL=admin@ecommy.local SEED_PASSWORD='Ecommy-2026!' SEED_STORE=demo npm run seed
# sin subir imágenes (usa las URLs del proveedor):
SEED_EMAIL=… SEED_PASSWORD=… npm run seed -- --skip-images
```

Estado actual de la base de desarrollo: 699 productos activos (catálogo DAZ),
70 categorías con jerarquía, 699 variantes "Default" con stock 10, 787
imágenes subidas al bucket `media` (`<store_id>/products/<product_id>/<archivo>`,
movidas desde `products/…` con `scripts/move-media-to-store.mts` después de la 0011).

## Recomendaciones para producción

- Cambiar la contraseña del usuario de prueba o eliminarlo.
- Activar "Leaked password protection" en Supabase Auth (advisor de seguridad).
- Revisar `store_settings.checkout.transfer` (CBU, alias, titular) antes de vender.

## Login automático de desarrollo

Con `DEV_LOGIN_EMAIL` y `DEV_LOGIN_PASSWORD` definidos en `.env.local` (y fuera
de producción), `GET /admin/auth/dev-login?next=/admin/pedidos` inicia la sesión
con esas credenciales y redirige (al panel de la tienda activa: la cookie
`ecommy_admin_store`; sin cookie, la primera tienda del usuario = `demo`).
`?next=/app` lleva a "Mis tiendas" y `?next=/platform` al panel de superadmin. Lo usa el QA automatizado para no tipear
contraseñas en formularios. En producción la ruta responde 404.
