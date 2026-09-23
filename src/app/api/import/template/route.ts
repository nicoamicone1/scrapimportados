import { assertFeature } from "@/lib/plans";
import { withAdmin } from "@/lib/scraper/api";
import { csvTemplate } from "@/lib/scraper/csv";

export const dynamic = "force-dynamic";

/** Plantilla CSV descargable: ?mode=update|create */
export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") === "create" ? "create" : "update";
  return withAdmin(async (ctx) => {
    assertFeature(ctx, "catalog.import_csv");
    const name = mode === "create" ? "plantilla-crear-productos.csv" : "plantilla-actualizar-por-sku.csv";
    return new Response(csvTemplate(mode), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
