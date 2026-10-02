import { ListOrdered } from "lucide-react";
import type { Metadata } from "next";

import { OrdersToProduce } from "@/components/admin/print3d/production/OrdersToProduce";
import { ProductionBoard } from "@/components/admin/print3d/production/ProductionBoard";
import type { BoardData } from "@/components/admin/print3d/production/types";
import { PageHeader } from "@/components/ui/display";
import { catalogRef, getWorkshop, listBoardJobs, listOrdersToProduce } from "@/lib/admin/print3d-production";
import { dueState, todayYmd } from "@/lib/admin/print3d-production-utils";
import { requireAdmin } from "@/lib/auth";
import { hasModule } from "@/lib/modules/registry";

export const metadata: Metadata = { title: "Cola de impresión · Taller 3D" };

export default async function ColaPage() {
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;

  const [workshop, jobs, toProduce] = await Promise.all([
    getWorkshop(ctx.supabase, ctx.store.id),
    listBoardJobs(ctx.supabase, ctx.store.id),
    listOrdersToProduce(ctx.supabase, ctx.store.id),
  ]);
  const now = new Date();
  const today = todayYmd(workshop.timezone, now);

  const data: BoardData = {
    jobs,
    printers: workshop.printers.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model,
      color: p.color,
      status: p.status,
      bed: p.bed,
      materials: p.materials,
    })),
    catalog: catalogRef(workshop),
    spools: workshop.spools.map((s) => ({
      id: s.id,
      color_id: s.color_id,
      brand: s.brand,
      remaining_grams: s.remaining_grams,
      net_grams: s.net_grams,
      status: s.status,
    })),
    today,
    nowIso: now.toISOString(),
    dailyPrintHours: workshop.settings.daily_print_hours,
  };

  const printing = jobs.filter((j) => j.status === "printing").length;
  const unassigned = jobs.filter((j) => !j.printer_id && j.status === "queued").length;
  const overdue = jobs.filter((j) => dueState(j.due_date, today, j.status) === "overdue").length;
  const description = jobs.length
    ? [
        `${jobs.length} ${jobs.length === 1 ? "trabajo" : "trabajos"}`,
        printing ? `${printing} imprimiendo` : null,
        unassigned ? `${unassigned} sin impresora` : null,
        overdue ? `${overdue} ${overdue === 1 ? "vencido" : "vencidos"}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "La cola está vacía. Los pedidos de cotizaciones entran solos; los del catálogo, desde \"Pedidos por producir\".";

  return (
    <>
      <PageHeader title="Cola de impresión" description={description} section="store" icon={<ListOrdered />} />
      <OrdersToProduce orders={toProduce} catalog={data.catalog} />
      <ProductionBoard data={data} />
    </>
  );
}
