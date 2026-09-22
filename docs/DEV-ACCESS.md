# Acceso de desarrollo

> **Sólo para desarrollo.** Antes de usar este proyecto en producción cambiá la
> contraseña (o borrá este usuario y creá el dueño real desde `/admin/setup`).

## Usuario admin de prueba

| Campo | Valor |
| --- | --- |
| URL | `http://localhost:3000/admin/login` (o el puerto de tu dev server) |
| Email | `admin@ecommy.local` |
| Contraseña | `Ecommy-2026!` |
| Rol | `owner` (activo) |

Proyecto Supabase: `asudscbvsrmulbpozjmq`.

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
3. El trigger `on_auth_user_created` creó el perfil: como no había owner, quedó
   `role = 'owner'`, `is_active = true`.
4. Se verificó el login con `signInWithPassword` y en el navegador.

## Otros usuarios

- Con un email "real" (dominio válido) podés crear cuentas con
  `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin`. Si ya hay dueño, la
  cuenta queda `pending` hasta que el owner la apruebe en `/admin/usuarios`.
- Si el proyecto exige confirmar email, `signUp` crea el usuario sin sesión:
  confirmalo desde el mail o con el mismo SQL de arriba (`email_confirmed_at`).

## Seed del catálogo

```bash
SEED_EMAIL=admin@ecommy.local SEED_PASSWORD='Ecommy-2026!' npm run seed
# sin subir imágenes (usa las URLs del proveedor):
SEED_EMAIL=… SEED_PASSWORD=… npm run seed -- --skip-images
```

Estado actual de la base de desarrollo: 699 productos activos (catálogo DAZ),
70 categorías con jerarquía, 699 variantes "Default" con stock 10, 787
imágenes subidas al bucket `media` (`products/<product_id>/<archivo>`).

## Recomendaciones para producción

- Cambiar la contraseña del usuario de prueba o eliminarlo.
- Activar "Leaked password protection" en Supabase Auth (advisor de seguridad).
- Revisar `store_settings.checkout.transfer` (CBU, alias, titular) antes de vender.

## Login automático de desarrollo

Con `DEV_LOGIN_EMAIL` y `DEV_LOGIN_PASSWORD` definidos en `.env.local` (y fuera
de producción), `GET /admin/auth/dev-login?next=/admin/pedidos` inicia la sesión
con esas credenciales y redirige. Lo usa el QA automatizado para no tipear
contraseñas en formularios. En producción la ruta responde 404.
