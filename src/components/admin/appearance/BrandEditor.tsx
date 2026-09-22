"use client";

import { useEffect, useState } from "react";

import { saveAnnouncement, saveBrand } from "@/app/admin/(panel)/apariencia/actions";
import { ColorField, ImageField, hrefError } from "@/components/admin/builder/fields";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui";
import type { AppearanceData } from "@/lib/admin/appearance";
import { cn } from "@/lib/cn";
import { contrastRatio, fontStack, type Theme } from "@/lib/theme";

/*
 * Marca (nombre, tagline, logo, favicon) y barra de anuncio → store_settings.
 */

function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
}

function HeaderSample({ bg, fg, logo, name, theme, label }: { bg: string; fg: string; logo: string; name: string; theme: Theme; label: string }) {
  return (
    <figure className="min-w-0 flex-1">
      <div className="flex h-14 items-center justify-between rounded-adm border border-adm-border px-4" style={{ background: bg, color: fg }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa del logo subido.
          <img src={logo} alt="" className="h-8 w-auto max-w-[60%] object-contain" />
        ) : (
          <span style={{ fontFamily: fontStack(theme.fonts.heading), fontWeight: theme.fonts.headingWeight, fontSize: 20 }}>{name || "Tu tienda"}</span>
        )}
        <span className="text-xs opacity-70">Productos · Carrito</span>
      </div>
      <figcaption className="mt-1 text-xs text-adm-fg-muted">{label}</figcaption>
    </figure>
  );
}

export function BrandEditor({ data }: { data: AppearanceData }) {
  const [brand, setBrand] = useState(data.brand);
  const [savedBrand, setSavedBrand] = useState(JSON.stringify(data.brand));
  const [ann, setAnn] = useState(data.announcement);
  const [savedAnn, setSavedAnn] = useState(JSON.stringify(data.announcement));
  const [brandErrors, setBrandErrors] = useState<Record<string, string[]>>({});
  const [annErrors, setAnnErrors] = useState<Record<string, string[]>>({});
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingAnn, setSavingAnn] = useState(false);

  const brandDirty = JSON.stringify(brand) !== savedBrand;
  const annDirty = JSON.stringify(ann) !== savedAnn;
  useUnsaved(brandDirty || annDirty);

  const theme = data.theme;
  const annBg = ann.bg || theme.colors.secondary;
  const annFg = ann.fg || theme.colors.text;
  const annContrast = contrastRatio(annFg, annBg);

  const submitBrand = async () => {
    setSavingBrand(true);
    const r = await saveBrand(brand);
    setSavingBrand(false);
    if (!r.ok) {
      setBrandErrors(r.fieldErrors ?? {});
      return void toast.error(r.error);
    }
    setBrandErrors({});
    setSavedBrand(JSON.stringify(brand));
    toast.success("Marca guardada");
  };

  const submitAnn = async () => {
    setSavingAnn(true);
    const r = await saveAnnouncement(ann);
    setSavingAnn(false);
    if (!r.ok) {
      setAnnErrors(r.fieldErrors ?? {});
      return void toast.error(r.error);
    }
    setAnnErrors({});
    setSavedAnn(JSON.stringify(ann));
    toast.success(ann.enabled ? "Barra de anuncio publicada" : "Barra de anuncio desactivada");
  };

  return (
    <div className="grid max-w-[960px] gap-5">
      <Card>
        <CardHeader title="Marca" description="Nombre, logo y favicon de la tienda. Se usan en el encabezado, el pie, los buscadores y la pestaña del navegador." />
        <CardBody className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <Field label="Nombre de la tienda" required error={brandErrors.name}>
              <Input value={brand.name} maxLength={80} onChange={(e) => setBrand({ ...brand, name: e.target.value })} />
            </Field>
            <Field label="Frase corta" hint="Qué vendés, en una línea. Aparece en el pie y en Google." error={brandErrors.tagline} aside={`${brand.tagline.length}/160`}>
              <Input value={brand.tagline} maxLength={160} placeholder="Bazar, cocina y audio con envío a todo el país" onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} />
            </Field>
            <ImageField
              label="Favicon"
              optional
              folder="brand"
              aspect="1 / 1"
              frameClassName="w-32"
              value={brand.favicon_url}
              onChange={(favicon_url) => setBrand({ ...brand, favicon_url })}
              hint="Cuadrado, PNG o SVG de 512 × 512 px. Es el ícono de la pestaña."
            />
          </div>
          <div className="space-y-4">
            <ImageField
              label="Logo"
              optional
              folder="brand"
              aspect="3 / 1"
              value={brand.logo_url}
              onChange={(logo_url) => setBrand({ ...brand, logo_url })}
              hint="PNG con fondo transparente o SVG, horizontal. Sin logo se muestra el nombre con la fuente de títulos."
            />
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-adm-fg">Cómo se ve</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <HeaderSample bg={theme.colors.background} fg={theme.colors.text} logo={brand.logo_url} name={brand.name} theme={theme} label="Sobre el fondo del tema" />
                <HeaderSample bg="#141414" fg="#FFFFFF" logo={brand.logo_url} name={brand.name} theme={theme} label="Sobre una foto oscura" />
              </div>
            </div>
          </div>
        </CardBody>
        <CardFooter>
          {brandDirty ? <span className="mr-auto text-xs font-medium text-adm-warning">Cambios sin guardar</span> : null}
          <Button disabled={!brandDirty || savingBrand} onClick={() => setBrand(JSON.parse(savedBrand) as typeof brand)}>
            Descartar
          </Button>
          <Button variant="primary" disabled={!brandDirty} loading={savingBrand} onClick={() => void submitBrand()}>
            Guardar marca
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader title="Barra de anuncio" description="Una línea arriba del encabezado en todas las páginas. Usala para un dato concreto: envío gratis, descuento, horario." />
        <CardBody className="space-y-4">
          <Switch label="Mostrar la barra" checked={ann.enabled} onCheckedChange={(enabled) => setAnn({ ...ann, enabled })} />
          <div
            className="flex h-8 items-center justify-center rounded-adm px-4 text-center text-xs"
            style={{ background: annBg, color: annFg, fontFamily: fontStack(theme.fonts.body), opacity: ann.enabled ? 1 : 0.5 }}
            aria-label="Vista previa de la barra"
          >
            <span className={cn(ann.href && "underline-offset-2 hover:underline")}>{ann.text || "Envío gratis desde $ 60.000 a todo el país"}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Texto" error={annErrors.text} aside={`${ann.text.length}/140`}>
              <Input value={ann.text} maxLength={140} placeholder="Envío gratis desde $ 60.000 a todo el país" onChange={(e) => setAnn({ ...ann, text: e.target.value })} />
            </Field>
            <Field label="Link" hint="Opcional. Ej.: /productos" error={annErrors.href ?? hrefError(ann.href)}>
              <Input value={ann.href} placeholder="/productos" className="font-mono text-[13px]" onChange={(e) => setAnn({ ...ann, href: e.target.value.trim() })} />
            </Field>
            <ColorField label="Fondo" allowEmpty value={ann.bg} onChange={(bg) => setAnn({ ...ann, bg })} hint="Vacío = color secundario del tema." />
            <ColorField label="Texto" allowEmpty value={ann.fg} onChange={(fg) => setAnn({ ...ann, fg })} hint="Vacío = color de texto del tema." />
          </div>
          {annErrors.bg || annErrors.fg ? <p className="text-xs text-adm-danger">{annErrors.bg?.[0] ?? annErrors.fg?.[0]}</p> : null}
          {annContrast < 4.5 ? (
            <p className="text-xs text-adm-warning">Contraste {annContrast.toFixed(1)}:1: el texto puede costar leerse (lo recomendable es 4.5:1 o más).</p>
          ) : null}
        </CardBody>
        <CardFooter>
          {annDirty ? <span className="mr-auto text-xs font-medium text-adm-warning">Cambios sin guardar</span> : null}
          <Button disabled={!annDirty || savingAnn} onClick={() => setAnn(JSON.parse(savedAnn) as typeof ann)}>
            Descartar
          </Button>
          <Button variant="primary" disabled={!annDirty} loading={savingAnn} onClick={() => void submitAnn()}>
            Guardar barra
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
