/**
 * Mueve los objetos "sueltos" del bucket `media` (carpetas que no son un
 * store_id, ej. `products/…` de antes de la 0011) a `<store_id>/…`.
 *
 *   SEED_EMAIL=admin@ecommy.local SEED_PASSWORD='…' npx tsx scripts/move-media-to-store.mts [slug]
 *
 * `slug` = tienda destino (por defecto `demo`). Corre como un superadmin
 * logueado (la policy `can_manage_media` lo deja operar en cualquier
 * carpeta). Usa la Storage API (`move`), que copia el archivo físico:
 * renombrar `storage.objects.name` por SQL NO alcanza. Idempotente: lo que
 * ya está bajo una carpeta uuid no se toca. La migración 0011 ya reescribió
 * las URLs de la base a la ruta nueva.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: se usan las variables del entorno.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SEED_EMAIL ?? process.env.DEV_LOGIN_EMAIL;
const password = process.env.SEED_PASSWORD ?? process.env.DEV_LOGIN_PASSWORD;
const slug = process.argv[2] ?? "demo";

if (!url || !anonKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!email || !password) throw new Error("Definí SEED_EMAIL y SEED_PASSWORD (un superadmin)");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONCURRENCY = 8;

const supabase = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
const bucket = supabase.storage.from("media");

async function listAll(prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Las "carpetas" no tienen id.
      if (entry.id === null) out.push(...(await listAll(full)));
      else out.push(full);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function pool<T>(items: T[], fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

async function main() {
  const { error: authError } = await supabase.auth.signInWithPassword({ email: email!, password: password! });
  if (authError) throw new Error(`Login: ${authError.message}`);

  const { data: store, error: storeError } = await supabase.from("stores").select("id").eq("slug", slug).single();
  if (storeError || !store) throw new Error(`No existe la tienda ${slug}`);

  const { data: roots, error } = await bucket.list("", { limit: 1000 });
  if (error) throw new Error(error.message);
  const legacy = (roots ?? []).filter((r) => r.id === null && !UUID_RE.test(r.name)).map((r) => r.name);
  console.log(`Carpetas a mover: ${legacy.join(", ") || "(ninguna)"}`);

  let moved = 0;
  let failed = 0;
  for (const folder of legacy) {
    const files = await listAll(folder);
    console.log(`${folder}: ${files.length} archivos`);
    await pool(files, async (name) => {
      const { error: moveError } = await bucket.move(name, `${store.id}/${name}`);
      if (moveError) {
        failed++;
        console.error(`  ✗ ${name}: ${moveError.message}`);
      } else if (++moved % 100 === 0) {
        console.log(`  ${moved} movidos…`);
      }
    });
  }
  console.log(`Listo: ${moved} movidos, ${failed} con error.`);
  if (failed) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
