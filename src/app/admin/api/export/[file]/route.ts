import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/admin/require";
import {
  auditRows,
  csvStream,
  customerRows,
  EXPORTS,
  inventoryRows,
  isExportKind,
  orderRows,
  productRows,
  type ExportKind,
} from "@/lib/admin/export";
import type { CsvValue } from "@/lib/admin/csv";
import { logAudit } from "@/lib/audit";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * GET /admin/api/export/{productos|inventario|pedidos|clientes|auditoria}.csv
 * CSV en streaming (UTF-8 con BOM). Requiere permiso `export`.
 * Pedidos: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=&pago=
 * Auditoría: ?usuario=&accion=&entidad=&desde=&hasta=&q=
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const kind = file.replace(/\.csv$/i, "");
  if (!file.toLowerCase().endsWith(".csv") || !isExportKind(kind)) {
    return new Response("No existe esa exportación.", { status: 404 });
  }

  let ctx;
  try {
    ctx = await requirePermission(kind === "auditoria" ? "audit.read" : "export");
  } catch {
    return new Response("No tenés permiso para exportar.", { status: 403 });
  }
  const { supabase } = ctx;

  const sp = request.nextUrl.searchParams;
  const { data: settings } = await supabase.from("store_settings").select("timezone").eq("id", 1).maybeSingle();
  const timeZone = settings?.timezone || DEFAULT_TIMEZONE;

  const filters: Record<string, string> = {};
  for (const [k, v] of sp.entries()) if (v) filters[k] = v;

  let rows: AsyncGenerator<CsvValue[]>;
  switch (kind as ExportKind) {
    case "productos":
      rows = productRows(supabase);
      break;
    case "inventario":
      rows = inventoryRows(supabase);
      break;
    case "pedidos":
      rows = orderRows(supabase, { from: sp.get("desde"), to: sp.get("hasta"), status: sp.get("estado"), payment: sp.get("pago") }, timeZone);
      break;
    case "clientes":
      rows = customerRows(supabase);
      break;
    case "auditoria":
      rows = auditRows(
        supabase,
        { actor: sp.get("usuario"), action: sp.get("accion"), entity: sp.get("entidad"), from: sp.get("desde"), to: sp.get("hasta"), q: sp.get("q") },
        timeZone,
      );
      break;
  }

  await logAudit(ctx, {
    action: "export.csv",
    entity: "export",
    entityId: kind,
    summary: `Exportó ${EXPORTS[kind].label.toLowerCase()} a CSV`,
    diff: Object.keys(filters).length ? { filtros: filters } : null,
  });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  return new Response(csvStream(EXPORTS[kind].header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${today}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
