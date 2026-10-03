"use client";

import { CircleCheck, Download, Loader2, Mail, MessageCircle, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { approveQuote, rejectQuote } from "@/app/admin/(panel)/taller-3d/cotizaciones/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { CatalogRef, QuoteDetail } from "@/lib/admin/print3d-production";
import { formatBbox, formatGrams, formatMinutes, formatYmdShort } from "@/lib/admin/print3d-production-utils";
import { waLink } from "@/lib/admin/whatsapp";
import { formatMoney, parseMoney } from "@/lib/money";
import { quoteTotals, REVIEW_REASON_LABELS } from "@/lib/print3d";
import type { PriceSettings, ReviewReason } from "@/lib/print3d/types";

import { Swatch } from "./bits";
import { useFileChecks, type FileCheck } from "./useFileCheck";

const Viewer = dynamic(() => import("@/components/print3d/Viewer"), {
  ssr: false,
  loading: () => <div className="size-full" aria-hidden />,
});

export interface QuoteReviewProps {
  quote: QuoteDetail;
  catalog: CatalogRef;
  settings: PriceSettings;
  /** Cama de la impresora activa más grande (grilla del visor). */
  bed: [number, number, number] | null;
  today: string;
  publicUrl: string;
  storeName: string;
  /** Días de validez al aprobar (`quote_valid_days`). */
  validDays: number;
}

const reasonLabel = (r: string) => (REVIEW_REASON_LABELS as Record<string, string>)[r as ReviewReason] ?? r;

/**
 * Revisión de una cotización: archivos con visor y verificación automática,
 * precio unitario editable por pieza, totales en vivo con el motor, nota al
 * cliente, aprobar / rechazar y aviso por WhatsApp o mail.
 */
export function QuoteReview({ quote, catalog, settings, bed, today, publicUrl, storeName, validDays }: QuoteReviewProps) {
  const router = useRouter();
  const locked = quote.status === "ordered";
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(quote.items.map((i) => [i.id, i.unit_price !== null ? String(i.unit_price) : ""])),
  );
  const [note, setNote] = useState(quote.review_note ?? "");
  const [readyDate, setReadyDate] = useState(quote.estimated_ready_date ?? "");
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const checks = useFileChecks(
    useMemo(
      () => quote.items.map((i) => ({ id: i.id, url: i.signedUrl, fileName: i.file_name, declared: i.geometry })),
      [quote.items],
    ),
  );

  const unit = (id: string) => {
    const v = parseMoney(prices[id] ?? "");
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const lineTotals = quote.items.map((i) => (unit(i.id) ?? 0) * i.qty);
  const missing = quote.items.some((i) => unit(i.id) === null);
  const totals = quoteTotals(lineTotals, settings);
  const changed = quote.items.some((i) => unit(i.id) !== i.unit_price);

  const approve = async () => {
    setPending("approve");
    const res = await approveQuote({
      quoteId: quote.id,
      items: quote.items.map((i) => ({ id: i.id, unitPrice: unit(i.id) ?? 0 })),
      reviewNote: note,
      readyDate: readyDate || null,
    });
    setPending(null);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setErrors({});
    toast.success(`Cotización aprobada por ${formatMoney(res.data.total)}. Avisale al cliente.`);
    router.refresh();
  };

  const reject = async () => {
    setPending("reject");
    const res = await rejectQuote({ quoteId: quote.id, reviewNote: note });
    setPending(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cotización rechazada. Avisale al cliente el motivo.");
    router.refresh();
  };

  const mismatches = quote.items.filter((i) => {
    const c = checks[i.id];
    return c?.status === "ready" && c.comparison && !c.comparison.matches;
  }).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {mismatches ? (
          <div role="alert" className="flex gap-2 rounded-adm border border-adm-danger/25 bg-adm-danger-soft px-4 py-3 text-[13px] text-adm-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">La geometría no coincide con el archivo</span> en {mismatches}{" "}
              {mismatches === 1 ? "pieza" : "piezas"}. El precio se calculó con medidas que no son las del STL: revisalo antes de aprobar.
            </p>
          </div>
        ) : null}
        {quote.items.map((item, idx) => (
          <ItemCard
            key={item.id}
            index={idx + 1}
            item={item}
            check={checks[item.id] ?? { status: "loading" }}
            catalog={catalog}
            bed={bed}
            price={prices[item.id] ?? ""}
            onPrice={(v) => setPrices((p) => ({ ...p, [item.id]: v }))}
            locked={locked}
            error={errors[`items.${idx}.unitPrice`]}
          />
        ))}
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader title={locked ? "Precio" : "Precio para el cliente"} />
          <CardBody className="space-y-4">
            <dl className="tnum space-y-1.5 text-[13px]">
              <TotalRow label="Piezas" value={formatMoney(totals.subtotal)} />
              {totals.setup_fee > 0 ? <TotalRow label="Preparación" value={formatMoney(totals.setup_fee)} /> : null}
              {totals.min_adjustment > 0 ? <TotalRow label="Ajuste a pedido mínimo" value={formatMoney(totals.min_adjustment)} /> : null}
              <div className="flex justify-between border-t border-adm-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{missing ? "—" : formatMoney(totals.total)}</dd>
              </div>
            </dl>
            {locked ? (
              <p className="text-[13px] text-adm-fg-muted">Ya es un pedido: cualquier cambio de precio se hace en el pedido.</p>
            ) : (
              <>
                <Field label="Listo aprox. el" hint="La fecha que le prometés. Vacío: la que calculó el cotizador." error={errors.readyDate}>
                  <Input type="date" min={today} value={readyDate} onChange={(e) => setReadyDate(e.target.value)} />
                </Field>
                <Field label="Nota para el cliente" hint="La ve en el link de la cotización. Ej.: «La imprimimos acostada para que no lleve soportes»." error={errors.reviewNote}>
                  <Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={approve}
                    loading={pending === "approve"}
                    disabled={missing || pending !== null}
                    className="max-sm:h-11"
                  >
                    {quote.status === "priced" && !changed ? "Renovar validez con este precio" : "Aprobar con este precio"}
                  </Button>
                  {quote.status !== "rejected" ? (
                    <Button variant="ghost" onClick={() => setRejectOpen(true)} disabled={pending !== null} className="max-sm:h-11">
                      Rechazar
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-adm-fg-muted">
                  Al aprobar, vale {validDays} {validDays === 1 ? "día" : "días"} y el cliente la puede pagar desde el link.
                </p>
              </>
            )}
          </CardBody>
        </Card>

        <NotifyCard quote={quote} publicUrl={publicUrl} storeName={storeName} />
      </div>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="¿Rechazar la cotización?"
        description={
          note.trim()
            ? "El cliente ve tu nota en el link. Después avisale por WhatsApp o mail."
            : "Conviene dejarle una nota con el motivo (no entra, no hacemos ese material…). La ve en el link."
        }
        confirmLabel="Rechazar cotización"
        destructive
        onConfirm={reject}
      />
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-adm-fg-muted">
      <dt>{label}</dt>
      <dd className="text-adm-fg">{value}</dd>
    </div>
  );
}

function ItemCard({
  index,
  item,
  check,
  catalog,
  bed,
  price,
  onPrice,
  locked,
  error,
}: {
  index: number;
  item: QuoteDetail["items"][number];
  check: FileCheck;
  catalog: CatalogRef;
  bed: [number, number, number] | null;
  price: string;
  onPrice: (v: string) => void;
  locked: boolean;
  error?: string[];
}) {
  const material = catalog.materials.find((m) => m.id === item.material_id);
  const color = catalog.colors.find((c) => c.id === item.color_id);
  const quality = catalog.qualities.find((q) => q.id === item.quality_id);
  const unitValue = parseMoney(price);
  const lineTotal = Number.isFinite(unitValue) && unitValue > 0 ? unitValue * item.qty : null;
  const comparison = check.status === "ready" ? check.comparison : null;
  const scale = comparison?.scale ?? 1;

  return (
    <Card>
      <CardHeader
        eyebrow={`Pieza ${index}`}
        title={<span className="break-all">{item.file_name}</span>}
        description={
          <span className="tnum">
            {item.format.toUpperCase()}
            {item.file_size ? ` · ${(item.file_size / 1_048_576).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB` : ""}
            {item.geometry ? ` · ${item.geometry.triangles.toLocaleString("es-AR")} triángulos` : ""}
          </span>
        }
        actions={
          item.signedUrl ? (
            <ButtonLink href={item.signedUrl} external size="sm" icon={<Download />}>
              Bajar
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-adm border border-adm-border bg-adm-surface-2 text-adm-fg-muted">
          {check.status === "ready" ? (
            <Viewer
              positions={check.positions}
              scale={scale}
              color={color?.hex ?? "#9A968C"}
              bed={bed}
              className="size-full"
              label={`Vista 3D de ${item.file_name}`}
              fallback={<p className="p-4 text-xs">Este navegador no muestra 3D. Bajá el archivo para verlo.</p>}
            />
          ) : (
            <div className="flex size-full items-center justify-center p-4 text-center text-xs">
              {check.status === "loading" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Bajando y analizando…
                </span>
              ) : (
                check.error
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3 text-[13px]">
          <div className="flex items-center gap-2">
            <Swatch hex={color?.hex} size={16} />
            <span className="font-medium">{[material?.type, color?.name].filter(Boolean).join(" ") || "Material sin definir"}</span>
            {quality ? <span className="text-adm-fg-muted">· {quality.name}</span> : null}
          </div>
          <dl className="tnum grid grid-cols-2 gap-x-4 gap-y-1">
            <Spec label="Relleno" value={`${item.infill_pct} %`} />
            <Spec label="Soportes" value={item.supports ? "Sí" : "No"} />
            <Spec label="Cantidad" value={`× ${item.qty}`} />
            <Spec label="Medidas" value={formatBbox(item.geometry?.bbox)} />
            <Spec label="Volumen" value={item.geometry ? `${(item.geometry.volume_mm3 / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} cm³` : "—"} />
            <Spec label="Por unidad" value={`${formatGrams(item.grams)} · ${formatMinutes(item.minutes)}`} />
          </dl>

          {item.review_reasons.length ? (
            <div className="flex flex-wrap gap-1.5">
              {item.review_reasons.map((r) => (
                <Badge key={r} tone={item.needs_review ? "amber" : "neutral"}>
                  {reasonLabel(r)}
                </Badge>
              ))}
            </div>
          ) : null}

          <GeometryVerdict check={check} />

          <div className="flex items-end gap-3 border-t border-adm-border pt-3">
            <Field label="Precio por unidad" error={error} className="flex-1">
              <Input
                inputMode="decimal"
                leading="$"
                value={price}
                onChange={(e) => onPrice(e.target.value)}
                disabled={locked}
                placeholder="A definir"
              />
            </Field>
            <div className="pb-2 text-right">
              <p className="text-xs text-adm-fg-muted">Total</p>
              <p className="tnum text-sm font-semibold">{lineTotal !== null ? formatMoney(lineTotal) : "—"}</p>
            </div>
          </div>
          {item.unit_price !== null && Number.isFinite(unitValue) && Math.abs(unitValue - item.unit_price) > 0.009 ? (
            <p className="text-xs text-adm-fg-muted">El cotizador había calculado {formatMoney(item.unit_price)}.</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-adm-fg-muted">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function GeometryVerdict({ check }: { check: FileCheck }) {
  if (check.status === "loading") {
    return <p className="text-xs text-adm-fg-muted">Verificando el archivo contra lo que calculó el cotizador…</p>;
  }
  if (check.status === "error") {
    return <p className="text-xs text-adm-warning">No se pudo verificar: {check.error}</p>;
  }
  const c = check.comparison;
  if (!c) return <p className="text-xs text-adm-fg-muted">El cotizador no guardó la geometría: no hay con qué comparar.</p>;
  const scaleNote =
    c.scale === 1
      ? null
      : c.unitHint === "cm"
        ? "el cliente lo pasó de cm a mm (×10)"
        : c.unitHint === "in"
          ? "el cliente lo pasó de pulgadas a mm (×25,4)"
          : `el cliente lo escaló ×${c.scale.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
  const pct = (v: number) => `${(v * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
  return c.matches ? (
    <p className="flex items-start gap-1.5 text-xs text-adm-success">
      <CircleCheck className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        El archivo coincide con lo cotizado{scaleNote ? `; ${scaleNote}` : ""}.
        {check.file.manifold ? "" : " La malla tiene agujeros: revisá que el laminador la cierre."}
      </span>
    </p>
  ) : (
    <div className={cn("rounded-adm border border-adm-danger/25 bg-adm-danger-soft px-3 py-2 text-xs text-adm-danger")}>
      <p className="font-semibold">La geometría no coincide con el archivo</p>
      <p className="tnum mt-0.5">
        Volumen {pct(c.diffs.volume)} · área {pct(c.diffs.area)} · medidas {pct(c.diffs.bbox)} · triángulos {pct(c.diffs.triangles)}
        {scaleNote ? ` (${scaleNote})` : ""}. Archivo real: {formatBbox(check.file.bbox.map((v) => v * c.scale))},{" "}
        {((check.file.volume_mm3 * c.scale ** 3) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} cm³.
      </p>
    </div>
  );
}

function NotifyCard({ quote, publicUrl, storeName }: { quote: QuoteDetail; publicUrl: string; storeName: string }) {
  const name = quote.contact.name?.split(" ")[0] ?? "";
  const hi = name ? `Hola ${name}` : "Hola";
  let text: string;
  if (quote.status === "priced") {
    text = `${hi}, te escribimos de ${storeName}. Ya está tu cotización de impresión 3D: ${quote.total !== null ? formatMoney(quote.total) : ""}${
      quote.estimated_ready_date ? `, lista aprox. el ${formatYmdShort(quote.estimated_ready_date)}` : ""
    }. La ves y la confirmás acá: ${publicUrl}`;
  } else if (quote.status === "rejected") {
    text = `${hi}, te escribimos de ${storeName}. Revisamos tus archivos y así como están no los podemos imprimir.${
      quote.review_note ? ` ${quote.review_note}` : ""
    } Te dejamos el detalle: ${publicUrl}`;
  } else if (quote.status === "ordered") {
    text = `${hi}, te escribimos de ${storeName}. Ya estamos con tu pedido de impresión 3D. Lo seguís acá: ${publicUrl}`;
  } else {
    text = `${hi}, te escribimos de ${storeName}. Recibimos tus archivos para imprimir en 3D y los estamos revisando. Te avisamos el precio por acá. ${publicUrl}`;
  }
  const wa = waLink(quote.contact.phone, text);
  const mail = quote.contact.email
    ? `mailto:${quote.contact.email}?subject=${encodeURIComponent(`Tu cotización de impresión 3D · ${storeName}`)}&body=${encodeURIComponent(text)}`
    : null;

  return (
    <Card>
      <CardHeader title="Cliente" />
      <CardBody className="space-y-3 text-[13px]">
        <div>
          <p className="text-sm font-medium">{quote.contact.name ?? "Sin nombre"}</p>
          {quote.contact.email ? (
            <a href={`mailto:${quote.contact.email}`} className="block break-all hover:underline">
              {quote.contact.email}
            </a>
          ) : null}
          {quote.contact.phone ? <p className="tnum">{quote.contact.phone}</p> : null}
          {!quote.contact.email && !quote.contact.phone ? (
            <p className="text-adm-fg-muted">No dejó contacto: sólo puede ver la cotización con su link.</p>
          ) : null}
        </div>
        {quote.notes ? (
          <div>
            <p className="font-medium">Nota del cliente</p>
            <p className="mt-0.5 whitespace-pre-line text-adm-fg-muted">{quote.notes}</p>
          </div>
        ) : null}
        <div className="space-y-2 border-t border-adm-border pt-3">
          <p className="text-xs text-adm-fg-muted">Avisale con el link de la cotización (se abre con el texto listo; nada se manda solo):</p>
          <p className="font-mono text-xs break-all text-adm-fg-muted">{publicUrl}</p>
          <div className="flex flex-wrap gap-2">
            {wa ? (
              <ButtonLink href={wa} external size="sm" variant="primary" icon={<MessageCircle />} className="max-sm:h-11">
                WhatsApp
              </ButtonLink>
            ) : null}
            {mail ? (
              <ButtonLink href={mail} external size="sm" icon={<Mail />} className="max-sm:h-11">
                Mail
              </ButtonLink>
            ) : null}
            <ButtonLink href={publicUrl} external size="sm" variant="ghost" className="max-sm:h-11">
              Ver como cliente
            </ButtonLink>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
