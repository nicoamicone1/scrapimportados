import { getSettings } from "@/lib/store/settings";
import { getTenant } from "@/lib/tenant/resolve";
import { storePath, storeUrl } from "@/lib/tenant/urls";

export const dynamic = "force-dynamic";

/** Paths privados de la tienda (sin prefijo). */
const PRIVATE_PATHS = ["/carrito", "/checkout", "/pedido/", "/buscar"];

/**
 * robots.txt de UNA tienda (P0-01). En subdominio/dominio propio el proxy
 * reescribe `/robots.txt` → `/s/<slug>/robots.txt`. Bloquea carrito,
 * checkout, pedidos y búsqueda; todo si la tienda está en mantenimiento.
 * (En modo fallback los crawlers leen el robots de la plataforma.)
 */
export async function GET(_request: Request, ctx: RouteContext<"/s/[store]/robots.txt">) {
  const { store: slug } = await ctx.params;
  const tenant = await getTenant(slug);
  const store = tenant.store;
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" };
  if (!store) return new Response("User-agent: *\nDisallow: /\n", { status: 404, headers });

  let maintenance = false;
  try {
    maintenance = (await getSettings(store.id)).maintenance.enabled;
  } catch {
    // Sin DB: robots con los bloqueos de siempre.
  }

  const root = storePath("/", tenant.basePath);
  const lines = ["User-agent: *"];
  if (maintenance) {
    lines.push(`Disallow: ${root}`);
  } else {
    lines.push(`Allow: ${root}`);
    for (const p of PRIVATE_PATHS) lines.push(`Disallow: ${storePath(p, tenant.basePath)}`);
    lines.push("", `Sitemap: ${storeUrl(store, "/sitemap.xml")}`);
  }
  return new Response(`${lines.join("\n")}\n`, { headers });
}
