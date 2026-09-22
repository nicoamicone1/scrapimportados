/**
 * Crea un usuario admin con `signUp` (cliente anon).
 *
 *   ADMIN_EMAIL=admin@ecommy.local ADMIN_PASSWORD='Ecommy-2026!' npx tsx scripts/create-admin.mts
 *
 * Si todavía no hay owner, el trigger `handle_new_user` lo convierte en owner
 * activo. Si ya hay owner, queda `pending` hasta que lo aprueben en
 * /admin/usuarios. Si el proyecto exige confirmar email, el script lo avisa
 * (ver docs/DEV-ACCESS.md para el alta por SQL).
 */
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: se usan las variables del entorno.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? "Admin";

if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!email || !password) throw new Error("Definí ADMIN_EMAIL y ADMIN_PASSWORD");

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { name } },
});

// Nota: se usa `process.exitCode` (no `process.exit()`) para no cortar handles
// abiertos de fetch en Windows.
if (error) {
  console.error(`signUp falló: ${error.message}`);
  console.error("Si el proveedor rechaza el dominio o exige confirmación, usá el alta por SQL (docs/DEV-ACCESS.md).");
  process.exitCode = 1;
} else if (!data.session) {
  console.warn(
    "Usuario creado pero SIN sesión: el proyecto exige confirmación de email. " +
      "Confirmalo desde el mail o con SQL (ver docs/DEV-ACCESS.md).",
  );
  process.exitCode = 2;
} else {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.session.user.id)
    .single();
  console.info(`Listo: ${email} (rol ${profile?.role ?? "?"}, activo ${profile?.is_active ?? "?"})`);
}
