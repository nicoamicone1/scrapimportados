# Apps de Ecommy (fase 0) + App "Taller 3D" (fase 1) — spec maestra

> Contrato entre agentes. Si algo de acá choca con el código real, gana el código
> real y lo anotás en tu reporte; no inventes otra forma sin avisar.
> Versión objetivo: **0.6.0**. Migración: **`supabase/migrations/0022_modules_print3d.sql`**.
> Sin MercadoPago: las apps las activa el superadmin desde `/platform` (el cobro va por fuera).

Público: emprendimientos de impresión 3D FDM con 3–10 impresoras. Qué resuelve:
cotizar un STL al instante desde la tienda, organizar la cola de cada impresora,
llevar el stock de filamento en gramos y saber el costo real de cada pedido.

---

## 0. Reglas de trabajo (todos los agentes)

- Leé `AGENTS.md` y, antes de tocar Next, la guía que aplique en `node_modules/next/dist/docs/` (Next 16.3: hay breaking changes).
- Leé `docs/ECOMMY-SPEC.md` §3–§5 (convenciones: `ActionResult`, `ok()/fail()`, `requireAdmin()`, `logAudit()`, errores en castellano rioplatense, sin `any`, sin `console.log`) y `docs/DESIGN.md` (admin §7). El storefront real vive en `src/app/s/[store]/` (no en `(store)` como dice §2 viejo).
- **Todos trabajamos en el MISMO worktree a la vez.** Tocá SÓLO los archivos de tu reparto (§9). Si necesitás algo de un archivo ajeno, lo pedís en tu reporte final.
- **No corras `next build` ni `next dev`** (pisa `.next` de los demás). Verificá con `npx tsc --noEmit` (ignorá errores de archivos ajenos en progreso), `npx eslint <tus archivos>` y `npx vitest run <tus tests>`.
- No hagas commits. No apliques migraciones a Supabase (lo hace el orquestador).
- Dependencias ya instaladas: `three`, `@types/three`, `fflate`. No agregues otras sin pedirlo.
- Textos de UI en español rioplatense, cortos, sin tono de "IA". Nada genérico: es para gente que imprime en 3D (hablá de bobinas, cama, relleno, capa, plato, warping).
- Plata en ARS con `src/lib/money.ts`. Fechas con `src/lib/dates.ts` / `date-fns` (zona de la tienda si está disponible; si no, `America/Argentina/Buenos_Aires`).

---

## 1. Fase 0 — Apps (módulos) de Ecommy

### 1.1 Base de datos (en 0022)

```sql
public.modules (
  code text primary key,                -- 'print3d'
  name text not null,                   -- 'Taller 3D'
  tagline text not null,                -- una línea
  description_md text not null default '',
  price_monthly numeric(12,2),          -- informativo (se cobra por fuera)
  is_public boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
)
public.store_modules (
  store_id uuid not null references public.stores(id) on delete cascade,
  module_code text not null references public.modules(code) on delete cascade,
  status text not null default 'active' check (status in ('active','trial','disabled')),
  activated_at timestamptz not null default now(),
  expires_at timestamptz,               -- null = sin vencimiento
  notes text,                           -- nota interna del superadmin (ej. "cobrado por transferencia")
  activated_by uuid references auth.users(id),
  created_at, updated_at (trigger set_updated_at),
  primary key (store_id, module_code)
)
```
- `public.store_has_module(p_store_id uuid, p_code text) returns boolean` — stable, security definer, `set search_path=''`: fila con `status in ('active','trial')` y `(expires_at is null or expires_at > now())`. Ejecutable por `anon` y `authenticated`.
- RLS: `modules` SELECT para todos; escritura sólo `is_platform_admin()`. `store_modules` SELECT `is_store_member(store_id)`; INSERT/UPDATE/DELETE sólo `is_platform_admin()`.
- Seed: `('print3d','Taller 3D','Cotizador de STL, cola de impresoras y stock de filamento', …, 24999, true, 0)`.

### 1.2 TypeScript — `src/lib/modules/`

- `registry.ts` (puro, sin server-only):
  ```ts
  export const MODULE_CODES = ["print3d"] as const;
  export type ModuleCode = (typeof MODULE_CODES)[number];
  export interface ModuleDef {
    code: ModuleCode; name: string; tagline: string;
    /** Ruta base del admin, ej. "/admin/taller-3d". */
    adminHref: string;
    /** Ítems del grupo "Apps" del sidebar cuando la app está activa. */
    nav: { label: string; href: string; icon: LucideIcon; keywords?: string[]; exact?: boolean }[];
    /** Rutas públicas del storefront que agrega (para páginas reservadas). */
    storefrontPaths: string[];
  }
  export const MODULES: Record<ModuleCode, ModuleDef>;
  ```
  print3d: `adminHref "/admin/taller-3d"`, nav: Taller 3D (`/admin/taller-3d`, exact, icon `Printer`), Cola de impresión (`/admin/taller-3d/cola`, `ListOrdered`), Cotizaciones (`/admin/taller-3d/cotizaciones`, `FileBox`), Filamento (`/admin/taller-3d/filamento`, `Cylinder`… elegí un ícono lucide que exista), `storefrontPaths: ["impresion-3d"]`.
- `server.ts` (`server-only`): `getStoreModules(supabase, storeId): Promise<ActiveModule[]>` (sólo activos/trial vigentes) y `requireModule(ctx: AdminContext, code): void` (lanza `AdminError` con mensaje "Esta app no está activa en tu tienda.").
- `AdminContext` suma `modules: ModuleCode[]` (se carga en paralelo con el plan en `src/lib/auth.ts`). Helper puro `hasModule(ctx, code)`.
- Público: `src/lib/store/modules.ts` → `storeHasModule(storeId, code)` con `unstable_cache` (tag `modules:<storeId>`, revalidate 300). El superadmin, al activar/desactivar, revalida ese tag.

### 1.3 UI fase 0

- **Sidebar/CommandPalette**: grupo "Apps" (sección visual nueva o reusar `store`) al final, antes de "Sistema", con los `nav` de las apps activas. `NAV` sigue estático; se agrega `buildNav(modules: ModuleCode[]): NavGroup[]` y los consumidores lo usan con `ctx.modules` (pasado desde el layout).
- **`/admin/apps`** (ítem fijo "Apps" en el grupo Sistema, icon `Blocks`): tarjetas de cada `modules.is_public`: nombre, tagline, descripción, precio informativo "$ 24.999/mes (se abona aparte)", estado (Activa / Prueba hasta X / No activa). Si no está activa: botón "Quiero activarla" → abre WhatsApp/mail al soporte de Ecommy (reusá el contacto que ya exista en la plataforma, ej. el de `/contacto`) con texto prearmado con el nombre de la tienda. Si está activa: "Abrir" → `adminHref`.
- **`/platform/tiendas/[id]`**: sección "Apps" con cada módulo: switch de estado (activa / prueba / desactivada), vencimiento opcional y nota. Acción de superadmin con `logAudit` y revalidación del tag.
- **Guard de rutas de app**: `src/app/admin/(panel)/taller-3d/layout.tsx` llama `requireAdmin()`, y si la tienda no tiene `print3d` muestra un estado vacío con carácter ("El Taller 3D no está activo en esta tienda" + botón a `/admin/apps`). Si está activa, renderiza un encabezado del módulo + tabs: Resumen · Cola · Cotizaciones · Impresoras · Filamento · Productos · Configuración.
- Toda server action del módulo arranca con `const ctx = await requireAdmin(); requireModule(ctx, "print3d");`.

---

## 2. Taller 3D — modelo de datos (en 0022)

Convenciones de ECOMMY-SPEC §3: `id uuid pk default gen_random_uuid()`, `store_id uuid not null references stores on delete cascade`, `created_at`, `updated_at` con trigger `set_updated_at()`, enums `text + check`, índices en FKs. RLS: miembros activos de la tienda ALL (`store_id = any((select public.admin_store_ids())::uuid[])` o `is_store_admin(store_id)`, como hagan las tablas vecinas) **y** escritura sólo si `store_has_module(store_id,'print3d')`. `anon` no lee ninguna tabla `print3d_*`: todo lo público pasa por RPC.

```
print3d_settings (store_id pk)
  enabled bool default true                 -- cotizador visible en la tienda
  hour_rate numeric(12,2) default 1500      -- precio de VENTA de la hora-máquina
  min_piece_price numeric(12,2) default 1500
  min_order_price numeric(12,2) default 5000
  setup_fee numeric(12,2) default 0         -- cargo fijo por pedido (preparación, laminado)
  post_process_fee numeric(12,2) default 0  -- por pieza (retirar soportes, lijado básico)
  support_extra_pct numeric(5,2) default 25 -- material extra si lleva soportes
  round_to numeric(12,2) default 100        -- redondeo HACIA ARRIBA del unitario (0 = centavos)
  max_auto_hours numeric(6,2) default 24    -- más horas por pieza = revisión manual
  max_file_mb int default 50  check 1..100
  quote_valid_days int default 7
  kwh_price numeric(12,2) default 150       -- costo, para rentabilidad
  labor_hour_cost numeric(12,2) default 4000-- costo de la hora de post-proceso
  daily_print_hours numeric(4,1) default 18 -- horas útiles de impresión por impresora por día
  post_process_days int default 1
  buffer_days int default 0
  working_days int[] default '{1,2,3,4,5}'  -- ISO: 1=lunes … 7=domingo (días de despacho)
  intro_md text default ''                  -- texto arriba del cotizador
  created_at, updated_at

print3d_printers
  name text, brand text, model text
  bed_x, bed_y, bed_z numeric(6,1) not null  (mm, > 0)
  nozzle_mm numeric(3,2) default 0.4
  materials text[] not null default '{PLA,PETG}'   -- tipos que puede imprimir
  watts numeric(7,1) default 150            -- consumo promedio
  purchase_price numeric(12,2) default 0
  lifetime_hours int default 5000           -- amortización = purchase_price / lifetime_hours por hora
  hours_used numeric(10,2) default 0        -- acumuladas por trabajos terminados
  status text check in ('active','maintenance','inactive') default 'active'
  color text default '#E86A33'              -- tinta en la cola
  position int default 0, notes text

print3d_materials
  type text check in ('PLA','PETG','ABS','ASA','TPU','NYLON','PC','OTRO')
  name text                                 -- "PLA Grilon3", "PETG Printalot"
  brand text
  density numeric(4,2) default 1.24         -- g/cm³
  price_per_gram numeric(10,2) not null     -- precio de VENTA por gramo
  speed_factor numeric(4,2) default 1       -- TPU ~0.5: multiplica el caudal g/h
  is_active bool default true, position int default 0

print3d_colors
  material_id uuid references print3d_materials on delete cascade
  name text, hex text default '#999999'
  is_active bool default true, position int default 0

print3d_spools
  color_id uuid references print3d_colors on delete restrict
  brand text
  net_grams int default 1000 check > 0
  remaining_grams numeric(8,1) not null     -- nunca < 0 (check >= 0)
  cost numeric(12,2) default 0              -- lo que pagó por la bobina
  status text check in ('sealed','open','empty') default 'sealed'
  purchased_at date, notes text
  -- costo por gramo = cost / net_grams

print3d_qualities
  code text                                 -- 'draft' | 'standard' | 'fine' | libre; unique (store_id, code)
  name text                                 -- "Borrador 0,28", "Estándar 0,20", "Fina 0,12"
  layer_height numeric(4,2)
  wall_mm numeric(4,2) default 1.2          -- espesor de paredes + techos/pisos
  throughput_g_h numeric(6,2) not null      -- gramos por hora de una impresora
  price_multiplier numeric(4,2) default 1
  is_active bool default true, position int default 0

print3d_calibration (store_id, material_id, quality_id) pk
  grams_factor numeric(6,3) default 1
  time_factor  numeric(6,3) default 1
  samples int default 0
  updated_at timestamptz

print3d_quotes
  token text unique not null                -- 32 chars aleatorios (URL pública)
  status text check in ('pending_review','priced','ordered','expired','rejected')
  contact jsonb default '{}'                -- {name,email,phone} (obligatorio si queda en revisión)
  notes text                                -- del cliente
  subtotal numeric(12,2), setup_fee numeric(12,2), min_adjustment numeric(12,2), total numeric(12,2)
  estimated_ready_date date
  expires_at timestamptz not null
  order_id uuid references orders on delete set null
  ip_hash text not null
  review_note text                          -- mensaje del taller al cliente
  reviewed_by uuid, reviewed_at timestamptz
  created_at, updated_at

print3d_quote_items
  quote_id uuid references print3d_quotes on delete cascade
  file_path text not null                   -- en el bucket print3d-files
  file_name text, file_size int, format text check in ('stl','3mf')
  geometry jsonb not null                   -- Geometry (§3.1), YA escalada a mm
  material_id, color_id, quality_id uuid (references, on delete restrict)
  infill_pct int check 0..100, supports bool, qty int check 1..500
  raw_grams numeric(10,2), raw_minutes numeric(10,2)     -- por unidad, SIN calibrar
  grams numeric(10,2), minutes numeric(10,2)             -- por unidad, calibrados
  unit_price numeric(12,2), total numeric(12,2)
  needs_review bool default false, review_reasons text[] default '{}'
  position int

print3d_product_specs                       -- productos del catálogo que se imprimen
  product_id uuid references products on delete cascade
  variant_id uuid null references product_variants on delete cascade   -- null = todas
  material_id uuid, color_id uuid null, quality_id uuid
  grams_per_unit numeric(10,2) not null
  minutes_per_unit numeric(10,2) not null
  units_per_plate int default 1
  post_minutes numeric(8,2) default 0
  made_to_order bool default false          -- muestra "listo aprox. el …" en la ficha
  unique (product_id, variant_id)  -- ojo: null en unique; usá un índice único con coalesce

print3d_jobs
  order_id uuid null references orders on delete set null
  order_item_id uuid null references order_items on delete set null
  quote_item_id uuid null references print3d_quote_items on delete set null
  product_id uuid null, variant_id uuid null
  parent_job_id uuid null references print3d_jobs  -- reimpresión
  title text not null, qty int default 1          -- piezas en este trabajo
  printer_id uuid null references print3d_printers on delete set null
  status text check in ('queued','printing','post','done','failed','cancelled') default 'queued'
  position int default 0                           -- orden dentro de la columna
  material_id, color_id, quality_id uuid null
  spool_id uuid null references print3d_spools on delete set null
  est_grams numeric(10,2), est_minutes numeric(10,2)          -- TOTAL del trabajo, calibrado
  raw_grams numeric(10,2), raw_minutes numeric(10,2)          -- TOTAL, sin calibrar (para calibrar)
  actual_grams numeric(10,2), actual_minutes numeric(10,2)
  wasted_grams numeric(10,2) default 0
  post_minutes numeric(8,2) default 0
  failure_reason text check in ('warping','atasco','despegue','corte_luz','filamento','capa','otro') null
  started_at, finished_at timestamptz, due_date date, notes text, created_by uuid
```

Storage: bucket **`print3d-files`** privado, `file_size_limit` 100 MB, mime permitidos: `model/stl`, `application/sla`, `application/vnd.ms-pki.stl`, `application/octet-stream`, `model/3mf`, `application/vnd.ms-package.3dmanufacturing-3dmodel+xml`, `application/zip`. Ruta: `<store_id>/q/<uuid>/<nombre-saneado>.<stl|3mf>`.
Policies: INSERT para `anon, authenticated` si el primer segmento es una tienda activa con `store_has_module(..,'print3d')` y el segundo segmento es `q`; SELECT/DELETE para `is_store_admin(<store_id del path>)`. Nadie hace UPDATE.

### 2.1 RPCs (security definer, `set search_path=''`, errores `raise exception` en castellano)

1. **`print3d_public_config(p_store_id uuid) returns jsonb`** — anon. `null` si la tienda no está activa, sin la app o `enabled=false`. Devuelve:
   ```json
   { "settings": { hour_rate, min_piece_price, min_order_price, setup_fee, post_process_fee, support_extra_pct,
                   round_to, max_auto_hours, max_file_mb, quote_valid_days, daily_print_hours,
                   post_process_days, buffer_days, working_days, intro_md },
     "materials": [{ id, type, name, density, price_per_gram, speed_factor,
                     colors: [{ id, name, hex, available_grams }] }],   // sólo activos; available = Σ remaining de bobinas no 'empty'
     "qualities": [{ id, code, name, layer_height, wall_mm, throughput_g_h, price_multiplier }],
     "calibration": [{ material_id, quality_id, grams_factor, time_factor, samples }],
     "printers": [{ id, bed: [x,y,z], materials: [...], backlog_minutes }],   // sólo 'active'; backlog = Σ est_minutes de jobs queued/printing asignados + reparto de los no asignados
     "made_to_order": [{ product_id, variant_id, minutes_per_unit, units_per_plate, material_type }] }
   ```
   (Nunca devuelve costos: cost de bobinas, watts, purchase_price, kwh, labor.)
2. **`print3d_submit_quote(p_store_id uuid, p_ip_hash text, payload jsonb) returns jsonb`** — anon.
   payload: `{ items: [{ file_path, file_name, file_size, format, geometry, material_id, color_id, quality_id, infill_pct, supports, qty }], contact?: {name,email,phone}, notes?, estimated_ready_date? }`.
   Valida: app activa; `p_ip_hash` no vacío; cupos (10 cotizaciones por ip_hash y tienda por día, 300 por tienda por día → "Llegaste al máximo de cotizaciones por hoy. Escribinos por WhatsApp."); 1–20 ítems; `file_path` empieza con `<store_id>/q/` y **existe** en `storage.objects` (bucket `print3d-files`); material/color/calidad activos y de la tienda, color del material; geometría plausible (§3.2 `geometryIsPlausible`).
   **Recalcula** gramos, minutos y precio con la fórmula §3.3 (espejo SQL `private.print3d_price_item(...)`) — nunca confía en precios del cliente. Marca revisión con las reglas §3.4. Si algún ítem queda en revisión → `status='pending_review'` y exige `contact.name` + (`email` o `phone`); si no → `'priced'`.
   `estimated_ready_date`: la manda la app (motor §3.5); la RPC la acota a `>= current_date + post_process_days + 1`. `expires_at = now() + quote_valid_days`.
   Devuelve `{ token, status, total }`.
3. **`print3d_get_quote(p_token text) returns jsonb`** — anon. Cotización + ítems (con nombres de material/color/calidad) + `store_id`. Marca `expired` al vuelo si venció y no está `ordered`. Nunca expone `ip_hash`, `file_path` ni costos.
4. **`print3d_checkout_quote(p_token text, payload jsonb) returns jsonb`** — anon. Cotización `priced` y vigente. `payload` = los mismos campos de cliente/entrega/pago que `create_order` (`customer`, `fulfillment`, `shipping_zone_id`, `pickup_location_id`, `shipping_address`, `payment_method_code`, `notes`) — copiá esa parte de `create_order` (0021): validaciones, cliente, envío (zona/envío gratis), descuento del medio de pago, numeración, token, `order_events` y cupo de avisos (0014). Sin cupones ni promos. Ítems: una `order_items` por ítem de la cotización (`product_id/variant_id` null, `name = 'Impresión 3D · ' || file_name`, `variant_title = 'PLA Negro · Estándar 0,20 · 20 % relleno[ · con soportes]'`, `unit_price = list_price = unit_price`, `qty`, `total`); si hay `min_adjustment` o `setup_fee` > 0, van como líneas extra ("Preparación del pedido", "Ajuste a pedido mínimo"). Crea un `print3d_jobs` por ítem (`status queued`, sin impresora, `est_*` y `raw_*` totales = por unidad × qty, `quote_item_id`, `order_item_id`, `due_date = estimated_ready_date`). Marca la cotización `ordered` + `order_id`. Devuelve lo mismo que `create_order` (`id, number, public_token, store_id, notify_customer`).
5. **`print3d_finish_job(p_job_id uuid, p_actual_grams numeric, p_actual_minutes numeric, p_spool_id uuid, p_post_minutes numeric) returns jsonb`** — authenticated, `is_store_admin`. Job `printing`/`queued`/`post` → `post` si `p_post_minutes is null` y se pide post-proceso… **simplificá**: pasa a `done`, setea actual_*, `finished_at`, descuenta `actual_grams` de la bobina (`remaining = greatest(0, …)`; si llega a 0 → `empty`; si estaba `sealed` → `open`), suma `actual_minutes/60` a `hours_used` de la impresora y **recalibra** (material, calidad) si el job tiene `raw_*` > 0: factor = mediana de `actual/raw` de los últimos 20 jobs `done` de ese par, acotado a [0.5, 2.0], `samples = n` (con `n < 3` el factor queda en 1).
6. **`print3d_fail_job(p_job_id uuid, p_wasted_grams numeric, p_reason text, p_requeue bool) returns jsonb`** — authenticated. `failed` + `wasted_grams` descontados de la bobina del job (si tiene) + `failure_reason`; si `p_requeue`, crea un job hijo `queued` copiando todo (`parent_job_id`), misma impresora, al final de su columna. Devuelve `{ requeued_job_id }`.

Grants: 1–4 a `anon, authenticated`; 5–6 sólo `authenticated`; `private.*` a nadie.
Tags de caché del storefront: `print3d:<storeId>` (config pública). Toda mutación del admin que cambie precios, materiales, colores, bobinas, calidades, impresoras o jobs revalida ese tag.

---

## 3. Motor puro — `src/lib/print3d/` (fuente única; testeado)

`types.ts` ya existe con los tipos y firmas (lo escribió el orquestador). Resumen:

### 3.1 Geometría
- `parseStl(buf: ArrayBuffer): Mesh` (binario y ASCII; detecta ASCII por `solid` + que el tamaño no cuadre con el binario).
- `parse3mf(buf: ArrayBuffer): Mesh` (`fflate.unzipSync`, lee `3D/3dmodel.model` y todos los `<object>`/`<build><item transform>`; aplica transformaciones; unidades de `<model unit>`→mm).
- `parseModel(buf, fileName): Mesh`.
- `analyzeMesh(mesh): Geometry` → `{ volume_mm3, area_mm2, bbox: [x,y,z], triangles, manifold }`. Volumen = |Σ tetraedros firmados|; `manifold` = cada arista compartida por exactamente 2 triángulos (con tolerancia de soldado 1e-4 mm vía hash de vértices cuantizados). Debe aguantar 1–2 M de triángulos en < 2 s en el navegador (typed arrays, sin objetos por vértice).
- `scaleGeometry(g, factor)`: volumen × f³, área × f², bbox × f.
- Unidades: la UI deja elegir mm / cm / pulgadas y escala % (el STL no trae unidades). `suggestUnit(bbox)`: si la mayor medida < 3 → sugerí "cm" o "pulgadas" con aviso.

### 3.2 Plausibilidad (TS y SQL idénticos)
`geometryIsPlausible(g)`: todo finito y > 0; `volume ≤ bx·by·bz · 1.001`; `area ≥ (36π·V²)^(1/3) · 0.99` (isoperimétrica); `triangles ≥ 4`; mayor medida ≤ 2000 mm.

### 3.3 Fórmula de precio (TS `priceItem` y SQL `private.print3d_price_item` IDÉNTICAS)
Por unidad, geometría en mm:
```
shell      = min(V, A · q.wall_mm)
material   = shell + (V − shell) · infill/100
material  *= supports ? (1 + s.support_extra_pct/100) : 1
raw_grams  = material / 1000 · m.density
raw_min    = raw_grams / (q.throughput_g_h · m.speed_factor) · 60
grams      = raw_grams · cal.grams_factor      (cal por material+calidad; sin fila = 1)
minutes    = raw_min   · cal.time_factor
base       = (grams · m.price_per_gram + minutes/60 · s.hour_rate) · q.price_multiplier + s.post_process_fee
unit_price = ceilTo(max(s.min_piece_price, base), s.round_to)     // ceilTo(x, r) = r>0 ? ceil(x/r)·r : round(x, 2)
total      = unit_price · qty
```
Cotización: `subtotal = Σ total`; `setup_fee = s.setup_fee`; `min_adjustment = max(0, s.min_order_price − (subtotal + setup_fee))`; `total = subtotal + setup_fee + min_adjustment`. Redondeos intermedios: gramos y minutos a 2 decimales antes de multiplicar precios (igual en SQL).

### 3.4 Revisión manual (`reviewReasons(item, ctx) → ReviewReason[]`)
- `no_fit`: no entra en ninguna impresora activa que imprima ese tipo de material (probá las 6 rotaciones de ejes: ordená bbox y cama y compará componente a componente).
- `too_long`: `minutes/60 > s.max_auto_hours`.
- `open_mesh`: `!manifold`.
- `too_small`: `V < 50 mm³`.
- `no_stock`: `available_grams` del color < `grams · qty · 1.1`.
- `implausible`: falla §3.2 (en SQL se rechaza con excepción en vez de revisión).
Textos para el cliente en `REVIEW_REASON_LABELS`.

### 3.5 Fecha de entrega (`estimateReadyDate`)
Entrada: impresoras `{id, bed, materials, backlog_minutes}`, trabajos nuevos `{minutes_total, material_type, bbox}`, settings, `now`.
Greedy: ordená trabajos por minutos desc; asigná cada uno a la impresora compatible con menor carga (carga inicial = backlog); `horas_max = max(carga final)/60` de las impresoras usadas; `días_impresión = ceil(horas_max / daily_print_hours)`; fecha = hoy + días_impresión (corridos) → luego sumá `post_process_days + buffer_days` **días hábiles** (`working_days`) y, si cae en día no hábil, mové al siguiente hábil. Devuelve `{ date: 'YYYY-MM-DD', assignments: {jobIndex: printerId}, printHours }`. Sin impresora compatible → `null`.

### 3.6 Costeo (`jobCost`, `orderCost`)
`jobCost({grams, minutes, wasted_grams, post_minutes}, {spool_cost_per_gram, printer:{watts, purchase_price, lifetime_hours}, kwh_price, labor_hour_cost})` →
`{ material, energy, amortization, labor, waste, total }` con energía = `watts/1000 · minutes/60 · kwh_price`, amortización = `purchase_price / lifetime_hours · minutes/60`, labor = `post_minutes/60 · labor_hour_cost`, waste = `wasted_grams · spool_cost_per_gram`. Usa reales si hay, si no estimados. Sin bobina: costo por gramo promedio de las bobinas de ese color (o del material); si no hay ninguna, 0 y `incomplete: true`.

### 3.7 Calibración (`calibrationFactor(samples: {actual, raw}[])`)
Mediana de `actual/raw` de hasta 20 muestras, acotada a [0.5, 2]; < 3 muestras → 1. (Espejo del SQL de `print3d_finish_job`.)

---

## 4. Storefront (agente C)

Rutas en `src/app/s/[store]/impresion-3d/` (sumá `"impresion-3d"` a `RESERVED_PAGE_SLUGS`). Si la app no está activa → `notFound()`. Todo con los tokens del tema de la tienda (`store.css`, variables del preset), responsive, accesible.

- **`/impresion-3d`** — Cotizador:
  - Encabezado con `intro_md`. Zona de arrastre grande "Soltá tus STL o 3MF acá" (+ botón). Varios archivos a la vez (hasta 20). Parseo **en el navegador** en un Web Worker (no congela la UI), con progreso.
  - Por pieza: visor 3D (three.js, `OrbitControls`, grilla de la cama de la impresora más grande, pieza apoyada en z=0, color = hex del color elegido, se re-pinta al cambiar), medidas "120 × 80 × 45 mm", selector de unidades mm/cm/pulg y escala %, material, color (swatches; los que no alcanzan quedan tachados con "sin stock"), calidad, relleno (10–100, pasos de 5, default 20), soportes (sí/no), cantidad. A la derecha: gramos, horas de impresión, precio unitario y total, que se recalculan en vivo con el motor §3 y `print3d_public_config`. Si aplica revisión: chip con el motivo ("No entra en nuestras impresoras: la cama más grande es de 256 × 256 × 256 mm").
  - Resumen fijo: subtotal, preparación, ajuste a mínimo, total, **"Lo tenés listo aprox. el jueves 9 de octubre"** (motor §3.5), y CTA "Continuar". Si hay ítems en revisión: CTA "Pedir revisión" + campos de contacto.
  - Al continuar: sube cada archivo a `print3d-files` con el cliente de Supabase del navegador (`upsert:false`, ruta §2) → server action `submitPrint3dQuote` (arma `ip_hash` con el helper que ya usa `checkout-sessions.ts`, llama la RPC) → redirige a `/impresion-3d/c/<token>`.
- **`/impresion-3d/c/[token]`** — Cotización:
  - Estado (`pending_review`: "El taller está revisando tu pedido. Te contestamos por WhatsApp o mail."; `priced`: vigente hasta X; `ordered`: link al pedido; `expired`/`rejected`). Ítems con miniatura (sin visor: nombre, material, color con swatch, calidad, relleno, cantidad, precio), `review_note` si hay, totales y fecha estimada.
  - Si `priced`: checkout en la misma página (Datos → Entrega → Pago → Confirmar), **reusando** lo que se pueda del checkout actual (`CheckoutFlow.tsx`, `quoteShippingAction`, métodos de pago; si reusar no es limpio, extraé piezas chicas sin romper el checkout existente o hacé una versión reducida). Server action `checkoutPrint3dQuote` → RPC `print3d_checkout_quote` → `notifyOrderCreated(...)` igual que `createOrder` → redirige a `/pedido/<public_token>` (la página de pedido existente ya muestra las líneas).
- **Ficha de producto**: si el producto tiene spec `made_to_order` → línea "Se imprime a pedido · listo aprox. el <fecha>" bajo el precio (motor §3.5 con `minutes_per_unit`).
- **Bloque del builder "Cotizador 3D"** (`print3d-cta`): título, texto, botón → `/impresion-3d`, e ícono/ilustración de pieza. Sólo aparece en la paleta del builder si la app está activa; en la tienda no renderiza nada si se desactivó.

## 5. Admin — Configuración del taller (agente D1)

Rutas `src/app/admin/(panel)/taller-3d/…` (el layout y tabs los hace A):
- **`impresoras/`**: tarjetas (no tabla) con color, nombre, marca/modelo, cama, materiales, estado, horas usadas y "hora-máquina te cuesta $ X" (energía + amortización). Alta/edición en Drawer. Presets de modelos comunes para autocompletar cama y watts: Bambu Lab A1 (256³, 95 W), A1 mini (180³, 80 W), P1S (256³, 130 W), X1C (256³, 140 W), Creality Ender 3 V3 (220×220×250, 120 W), K1 (220³, 150 W), K1 Max (300³, 200 W), Prusa MK4 (250×210×220, 100 W), Prusa Mini+ (180³, 80 W), Anycubic Kobra 3 (250³, 120 W). Estados rápidos (activa / mantenimiento / inactiva).
- **`filamento/`**: materiales (con sus colores como swatches editables) y bobinas. Vista principal = **estante de bobinas** agrupado por material → color: barra de gramos restantes, costo por kg, estado; alerta "Stock bajo" cuando un color tiene < 250 g sumando bobinas. Acciones: agregar bobinas (N iguales de una), ajustar gramos (pesaje), marcar vacía. Precio de venta por gramo del material con sugerencia "costo promedio $ X/kg × margen".
- **`configuracion/`**: precios (hora-máquina, mínimos, preparación, post-proceso, soportes, redondeo), calidades (tabla editable con capa, paredes, g/h, multiplicador), calendario (horas de impresión por día, días de post-proceso, colchón, días de despacho), costos (kWh, hora de post-proceso), cotizador (activado, texto de intro, MB máximos, validez), y **calibración** (tabla material × calidad con factores, muestras y "resetear"). Con un **simulador**: "Una pieza de 100 g en PLA estándar sale $ X y tarda Y h" que se actualiza mientras editás.
- **`productos/`**: productos del catálogo que se imprimen: buscador de productos → spec (material, color, calidad, gramos, minutos, piezas por plato, post-proceso, a pedido). Muestra costo estimado vs precio de venta y margen por unidad.
- Onboarding: si no hay impresoras/materiales/calidades, el Resumen invita a "Cargar valores de ejemplo" (3 calidades, PLA/PETG/TPU con colores comunes y 1 impresora A1) → server action idempotente (vive en D1: `configuracion/actions.ts` → `seedPrint3dDefaults`).

## 6. Admin — Producción (agente D2)

- **`/admin/taller-3d`** (Resumen): cola de hoy, ocupación de cada impresora (horas cargadas vs `daily_print_hours`), cotizaciones por revisar, colores con stock bajo, trabajos fallados de la semana y tasa de fallas, margen de los últimos 30 días (§3.6).
- **`cola/`**: tablero **columnas = impresoras** (+ columna "Sin asignar"), tarjetas = trabajos (título, pedido #, material+color swatch, horas, fecha comprometida en rojo si se pasa). Drag & drop (`@dnd-kit`, ya instalado) para asignar/reordenar. Acciones en la tarjeta: Empezar (→ printing, `started_at`, elegir bobina de ese color), Terminar (modal con gramos y minutos reales prellenados con lo estimado, bobina, minutos de post-proceso → RPC `print3d_finish_job`), Falló (motivo, gramos perdidos, reimprimir sí/no → `print3d_fail_job`), Cancelar. Filtros: estado, material. Botón "Sugerir asignación" que usa el greedy §3.5 para los no asignados.
  - Arriba del tablero: **"Pedidos por producir"**: pedidos `confirmed`/`preparing` (o `pending` pagados) con productos que tienen spec y aún sin jobs → "Mandar a la cola" crea jobs (agrupa por piezas por plato).
- **`cotizaciones/`** (+ `[id]`): lista con estado; detalle con los archivos (descarga por URL firmada), visor 3D, **verificación automática**: baja el archivo, lo analiza con el motor y compara con la geometría declarada (si difiere > 3 % → alerta "La geometría no coincide con el archivo"), motivos de revisión, edición de precio unitario por ítem, nota al cliente, y acciones "Aprobar con este precio" (→ `priced`, recalcula totales, nueva validez) / "Rechazar". Botón "Avisar por WhatsApp/mail" con el link `/impresion-3d/c/<token>`.
- **Pedido** (`src/app/admin/(panel)/pedidos/[id]/page.tsx`): D2 agrega UNA línea que renderiza `<Print3dOrderPanel orderId=… />` (sólo si la app está activa): trabajos del pedido con estado, archivos, costo real vs precio y margen (§3.6).

## 7. QA mínima (cada agente, antes de reportar)
- `npx tsc --noEmit` sin errores en tus archivos; eslint limpio en tus archivos; tests nuevos verdes.
- El motor (B) con tests: cubo de 20 mm (V=8000, A=2400), STL ASCII y binario, 3MF con transformación, malla abierta, rotaciones de `no_fit`, redondeos de precio, mínimo de pedido, fecha con fin de semana, mediana de calibración.

## 8. Fuera de alcance (fase 2+)
Cobro de la app por MercadoPago, integración en vivo con impresoras (Bambu MQTT / Moonraker / OctoPrint), laminado real server-side, carritos mixtos (catálogo + cotización en el mismo checkout), personalizador de texto, mantenimiento por horas, cotizaciones PDF, limpieza automática de archivos de cotizaciones vencidas.

## 9. Reparto de archivos
| Agente | Archivos |
|---|---|
| **DB** | `supabase/migrations/0022_modules_print3d.sql`, `src/lib/supabase/database.types.ts` (agregar tablas/funciones a mano con el formato generado) |
| **A — Apps (fase 0)** | `src/lib/modules/**`, `src/lib/auth.ts` (sólo sumar `modules`), `src/lib/store/modules.ts`, `src/components/admin/nav.ts` + `Sidebar.tsx` + `CommandPalette.tsx` + lo que pase `modules` desde `admin/(panel)/layout.tsx`, `src/app/admin/(panel)/apps/**`, `src/app/admin/(panel)/taller-3d/layout.tsx` (+ componente de tabs en `src/components/admin/print3d/ModuleTabs.tsx`), `src/app/(platform)/platform/tiendas/[id]/**` (sección Apps) |
| **B — Motor** | `src/lib/print3d/**` (salvo `types.ts`, que podés ajustar avisando), worker `src/lib/print3d/worker.ts` |
| **C — Storefront** | `src/app/s/[store]/impresion-3d/**`, `src/components/store/print3d/**`, `src/components/print3d/Viewer.tsx` (visor compartido con D2), bloque `print3d-cta` (en `src/components/blocks/` + registro en `src/lib/blocks/`), `src/lib/schemas/page.ts` (slug reservado), línea en la ficha de producto, `src/lib/store/print3d.ts` (config pública cacheada) |
| **D1 — Config** | `src/app/admin/(panel)/taller-3d/{impresoras,filamento,configuracion,productos}/**`, `src/lib/admin/print3d-config.ts`, `src/components/admin/print3d/config/**` |
| **D2 — Producción** | `src/app/admin/(panel)/taller-3d/{page.tsx,cola,cotizaciones}/**`, `src/lib/admin/print3d-production.ts`, `src/components/admin/print3d/production/**`, 1 línea en `pedidos/[id]/page.tsx` |
| **Orquestador** | esta spec, `types.ts`, versión 0.6.0, CHANGELOG, `docs/ECOMMY-SPEC.md`, aplicar migración, QA, commit |
