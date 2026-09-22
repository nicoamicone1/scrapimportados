import { NextResponse } from "next/server";

import { jsonError, withAdmin } from "@/lib/scraper/api";
import { createCsvJob, CsvJobError, decodeCsv } from "@/lib/scraper/csv-job";
import { CSV_MAX_BYTES, csvModeSchema, importOptionsSchema } from "@/lib/schemas/import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST multipart: file (CSV ≤ 8 MB), mode ('update' | 'create'), options (JSON).
 * Crea el job en fase "review" con el diff por fila y devuelve su id.
 */
export async function POST(request: Request) {
  return withAdmin(async (ctx) => {
    const len = Number(request.headers.get("content-length"));
    if (Number.isFinite(len) && len > CSV_MAX_BYTES + 64 * 1024) return jsonError("El archivo supera los 8 MB.", 413);

    const form = await request.formData().catch(() => null);
    if (!form) return jsonError("No llegó el archivo.");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return jsonError("Elegí un archivo CSV.");
    if (file.size > CSV_MAX_BYTES) return jsonError("El archivo supera los 8 MB.", 413);
    if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text\/plain/i.test(file.type)) {
      return jsonError("El archivo tiene que ser .csv (exportá la planilla como CSV).");
    }
    const mode = csvModeSchema.safeParse(form.get("mode"));
    if (!mode.success) return jsonError("Elegí el modo de importación.");
    let rawOptions: unknown = {};
    try {
      rawOptions = JSON.parse(String(form.get("options") ?? "{}"));
    } catch {
      return jsonError("Opciones inválidas.");
    }
    const options = importOptionsSchema.safeParse(rawOptions);
    if (!options.success) return jsonError(options.error.issues[0]?.message ?? "Opciones inválidas.");
    if (options.data.category_mode === "single" && !options.data.default_category_id) {
      return jsonError("Elegí la categoría donde van los productos.");
    }

    const text = decodeCsv(new Uint8Array(await file.arrayBuffer()));
    try {
      const { jobId } = await createCsvJob(ctx, {
        fileName: file.name.slice(0, 120),
        text,
        mode: mode.data,
        options: options.data,
      });
      return NextResponse.json({ ok: true as const, jobId });
    } catch (err) {
      if (err instanceof CsvJobError) return jsonError(err.message, 422);
      throw err;
    }
  });
}
