"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useState } from "react";

import { saveLegalSettings } from "@/app/admin/(panel)/configuracion/actions";
import { useOptionalAdminStore } from "@/components/admin/AdminStoreContext";
import { Button } from "@/components/ui/Button";
import { Card, FormSection } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { LEGAL_DISCLAIMER, LEGAL_TEMPLATES, renderLegalTemplate } from "@/lib/legal/templates";
import { formatMoney } from "@/lib/money";
import { isValidCuit, POLICY_KEYS, VAT_OPTIONS, type LegalSettingsInput, type PolicyKey } from "@/lib/schemas/settings";

import { HeaderSave, SaveBar } from "./SaveBar";
import { SettingsHeader } from "./SettingsHeader";
import { MarkdownField } from "./TemplateInput";
import { useSettingsForm } from "./useSettingsForm";

const COUNTRY_OPTIONS = [
  { value: "AR", label: "Argentina" },
  { value: "UY", label: "Uruguay" },
  { value: "CL", label: "Chile" },
  { value: "PY", label: "Paraguay" },
  { value: "BO", label: "Bolivia" },
  { value: "PE", label: "Perú" },
  { value: "CO", label: "Colombia" },
  { value: "MX", label: "México" },
  { value: "ES", label: "España" },
  { value: "OTHER", label: "Otro" },
];

const CONSUMER_DEFENSE_URL = "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario";

function vatLabel(n: number) {
  return `${String(n).replace(".", ",")} %`;
}

export function LegalForm({ initial, store }: { initial: LegalSettingsInput; store: { name: string; email: string; address: string } }) {
  const form = useSettingsForm(initial, saveLegalSettings);
  const { values: v, set, error } = form;
  const [policy, setPolicy] = useState<PolicyKey>("shipping_md");
  const [confirmTemplate, setConfirmTemplate] = useState(false);
  // Link a la política en la tienda activa (`/s/<slug>/…` en modo fallback).
  const storeBase = (useOptionalAdminStore()?.store.href ?? "").replace(/\/+$/, "");

  const vat = Number(String(v.tax.default_vat_percent).replace(",", "."));
  const sample = 12100;
  const net = Number.isFinite(vat) ? sample / (1 + vat / 100) : sample;
  const isAR = v.legal.country === "AR";
  const cuitRaw = v.legal.cuit ?? "";
  const cuitBad = cuitRaw.trim() !== "" && !isValidCuit(cuitRaw);

  const insertTemplate = () => {
    set(
      `policies.${policy}`,
      renderLegalTemplate(policy, {
        name: store.name,
        razon_social: v.legal.razon_social ?? "",
        cuit: v.legal.cuit ?? "",
        email: store.email,
        address: store.address,
      }),
    );
  };

  const current = v.policies[policy] ?? "";
  const missing = [
    !v.legal.razon_social?.trim() && "razón social",
    !cuitRaw.trim() && "CUIT",
    !store.email && "email de contacto",
    !store.address && "dirección",
  ].filter(Boolean) as string[];

  return (
    <>
      <SettingsHeader
        title="Impuestos y legales"
        description="Lo que la ley pide mostrar en una tienda online en Argentina."
        actions={<HeaderSave dirty={form.dirty} saving={form.saving} onSave={form.save} />}
      />

      <Card className="max-w-5xl px-5 md:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.save();
          }}
          className="divide-y divide-adm-border"
        >
          <FormSection
            title="Precio sin impuestos nacionales"
            description={
              <>
                Desde abril de 2025, la Ley 27.743 y la Resolución SIC 4/2025 exigen mostrar, junto al precio final, el precio sin IVA ni otros impuestos
                nacionales indirectos. Si sos monotributista no discriminás IVA y podés dejarlo apagado; consultalo con tu contador.
              </>
            }
          >
            <Switch
              checked={v.tax.show_net_price}
              onCheckedChange={(on) => set("tax.show_net_price", on)}
              label="Mostrar el precio sin impuestos"
              description="En las cards, la ficha, el carrito y el checkout, en letra más chica."
            />
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="Alícuota de IVA por defecto" hint="Cada producto puede tener la suya." error={error("tax.default_vat_percent")}>
                <Select
                  value={String(v.tax.default_vat_percent)}
                  onChange={(e) => set("tax.default_vat_percent", e.target.value)}
                  options={VAT_OPTIONS.map((n) => ({ value: String(n), label: vatLabel(n) }))}
                />
              </Field>
              <Field label="Leyenda" error={error("tax.label")}>
                <Input value={v.tax.label} onChange={(e) => set("tax.label", e.target.value)} maxLength={60} />
              </Field>
            </div>
            <div className="rounded-adm border border-adm-border bg-adm-surface-2/60 px-3 py-2.5">
              <p className="text-xs text-adm-fg-muted">Así se ve en un producto de {formatMoney(sample)}</p>
              <p className="tnum mt-1 text-base font-semibold">{formatMoney(sample)}</p>
              <p className={cn("tnum text-xs text-adm-fg-muted", !v.tax.show_net_price && "line-through")}>
                {v.tax.label.toUpperCase() || "PRECIO SIN IMPUESTOS NACIONALES"}: {formatMoney(net, { decimals: 2 })}
              </p>
            </div>
          </FormSection>

          <FormSection title="Datos del comercio" description="Se muestran en el pie de la tienda y completan las plantillas de políticas.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="País" error={error("legal.country")}>
                <Select value={v.legal.country} onChange={(e) => set("legal.country", e.target.value)} options={COUNTRY_OPTIONS} />
              </Field>
              <Field
                label="CUIT"
                hint={cuitBad ? "El dígito verificador no coincide." : "Del titular del comercio. Ej. 30-71234567-1"}
                error={error("legal.cuit")}
              >
                <Input
                  value={cuitRaw}
                  onChange={(e) => set("legal.cuit", e.target.value)}
                  inputMode="numeric"
                  maxLength={13}
                  className="font-mono"
                  invalid={cuitBad || undefined}
                />
              </Field>
            </div>
            <Field label="Razón social" hint="Como figura en ARCA (ex AFIP)." error={error("legal.razon_social")}>
              <Input value={v.legal.razon_social ?? ""} onChange={(e) => set("legal.razon_social", e.target.value)} maxLength={120} />
            </Field>
            {isAR ? (
              <Switch
                checked={v.legal.consumer_defense_link}
                onCheckedChange={(on) => set("legal.consumer_defense_link", on)}
                label="Link a Defensa del Consumidor"
                description={
                  <>
                    «Defensa de las y los consumidores. Para reclamos ingresá acá», al pie de la tienda. Obligatorio para vender online en Argentina.{" "}
                    <a href={CONSUMER_DEFENSE_URL} target="_blank" rel="noopener noreferrer" className="text-adm-accent underline-offset-2 hover:underline">
                      Ver formulario
                    </a>
                  </>
                }
              />
            ) : null}
          </FormSection>

          {isAR ? (
            <FormSection
              title="Data Fiscal (ARCA)"
              description="El QR del formulario 960/D. ARCA te da un código para pegar en la web: acá cargá sólo la URL de la imagen del QR y el link al que apunta (por seguridad no se acepta el script)."
            >
              <Field label="URL de la imagen del QR" hint="Empieza con https:// y termina en .jpg o .png (por ejemplo https://www.afip.gob.ar/images/f960/DATAWEB.jpg)." error={error("legal.data_fiscal.image_url")}>
                <Input
                  type="url"
                  value={v.legal.data_fiscal.image_url ?? ""}
                  onChange={(e) => set("legal.data_fiscal.image_url", e.target.value)}
                  placeholder="https://www.afip.gob.ar/images/f960/DATAWEB.jpg"
                />
              </Field>
              <Field label="Link del QR" hint="La dirección del atributo href del código que te dio ARCA (qr.afip.gob.ar/?qr=…)." error={error("legal.data_fiscal.href")}>
                <Input
                  type="url"
                  value={v.legal.data_fiscal.href ?? ""}
                  onChange={(e) => set("legal.data_fiscal.href", e.target.value)}
                  placeholder="http://qr.afip.gob.ar/?qr=…"
                />
              </Field>
              {v.legal.data_fiscal.image_url && /^https?:\/\//.test(v.legal.data_fiscal.image_url) ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL externa arbitraria de ARCA, sin optimizar */}
                  <img src={v.legal.data_fiscal.image_url} alt="QR de Data Fiscal" width={64} height={88} className="h-[88px] w-16 rounded-[4px] border border-adm-border object-contain" />
                  <span className="text-xs text-adm-fg-muted">Vista previa del QR tal como se va a ver en el pie.</span>
                </div>
              ) : null}
            </FormSection>
          ) : null}

          <FormSection
            title="Políticas"
            description={
              <>
                Se publican en /politicas/… y se enlazan en el pie y en el checkout. Podés partir de una plantilla y ajustarla a tu negocio.{" "}
                <span className="font-medium text-adm-fg">{LEGAL_DISCLAIMER}</span>
              </>
            }
          >
            <div role="tablist" aria-label="Política" className="flex flex-wrap gap-x-5 border-b border-adm-border">
              {POLICY_KEYS.map((key) => {
                const filled = Boolean((v.policies[key] ?? "").trim());
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={policy === key}
                    onClick={() => setPolicy(key)}
                    className={cn(
                      "-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 text-sm",
                      policy === key ? "border-adm-accent font-medium text-adm-fg" : "border-transparent text-adm-fg-muted hover:text-adm-fg",
                    )}
                  >
                    {LEGAL_TEMPLATES[key].title}
                    <span
                      aria-label={filled ? "completa" : "vacía"}
                      className={cn("size-1.5 rounded-full", filled ? "bg-adm-success" : "bg-adm-border")}
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-adm-fg-muted">
                Se ve en{" "}
                <a
                  href={`${storeBase}/politicas/${LEGAL_TEMPLATES[policy].slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-adm-accent hover:underline"
                >
                  /politicas/{LEGAL_TEMPLATES[policy].slug}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </p>
              <Button size="sm" icon={<FileText />} onClick={() => (current.trim() ? setConfirmTemplate(true) : insertTemplate())}>
                Insertar plantilla
              </Button>
            </div>
            {missing.length ? (
              <p className="text-xs text-adm-warning">
                Para completar la plantilla falta: {missing.join(", ")}. Quedan marcados entre corchetes.
              </p>
            ) : null}
            <Field label={LEGAL_TEMPLATES[policy].title} error={error(`policies.${policy}`)}>
              <MarkdownField
                key={policy}
                rows={16}
                value={current}
                onChange={(val) => set(`policies.${policy}`, val)}
                placeholder="Escribí la política o insertá la plantilla."
              />
            </Field>
          </FormSection>
          <button type="submit" hidden />
        </form>
      </Card>

      <ConfirmDialog
        open={confirmTemplate}
        onOpenChange={setConfirmTemplate}
        title="¿Reemplazar el texto actual?"
        description={`La política «${LEGAL_TEMPLATES[policy].title}» ya tiene texto. La plantilla lo reemplaza (podés descartar los cambios antes de guardar).`}
        confirmLabel="Reemplazar con la plantilla"
        destructive
        onConfirm={insertTemplate}
      />
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} errorCount={Object.keys(form.errors).length} />
    </>
  );
}
