"use client";

import { AlertTriangle, ChevronRight, ImageUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { saveSeoSettings } from "@/app/admin/(panel)/configuracion/actions";
import { IMAGE_ACCEPT, uploadImage } from "@/components/admin/products/image-upload";
import { SeoFields } from "@/components/admin/SeoFields";
import { Button } from "@/components/ui/Button";
import { Card, FormSection } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { SeoSettingsInput } from "@/lib/schemas/settings";

import { HeaderSave, SaveBar } from "./SaveBar";
import { SettingsHeader } from "./SettingsHeader";
import { useSettingsForm } from "./useSettingsForm";

export function SeoForm({ initial, storeName, tagline }: { initial: SeoSettingsInput; storeName: string; tagline: string }) {
  const form = useSettingsForm(initial, saveSeoSettings);
  const { values: v, set, error } = form;
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const img = await uploadImage(file, "brand");
      set("seo.og_image_url", img.url);
      toast.success("Imagen subida. Guardá para aplicarla.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <SettingsHeader
        title="SEO e integraciones"
        description="Cómo aparece la tienda en Google y al compartirla, y los códigos de medición."
        actions={
          <>
            <Link href="/admin/configuracion/seo/redirecciones" className="inline-flex h-8 items-center gap-1 rounded-adm px-2.5 text-sm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg">
              Redirecciones 301
              <ChevronRight className="size-4" aria-hidden />
            </Link>
            <HeaderSave dirty={form.dirty} saving={form.saving} onSave={form.save} />
          </>
        }
      />

      {v.maintenance.enabled ? (
        <div role="alert" className="mb-4 flex max-w-5xl items-center gap-3 rounded-adm border border-adm-danger/40 bg-adm-danger-soft px-4 py-3 text-sm text-adm-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">Modo mantenimiento {initial.maintenance.enabled ? "activo" : "a punto de activarse"}.</span> Los visitantes ven el mensaje y no pueden comprar.
            Vos seguís viendo la tienda porque estás logueado en el panel.
          </p>
        </div>
      ) : null}

      <Card className="max-w-5xl px-5 md:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.save();
          }}
          className="divide-y divide-adm-border"
        >
          <FormSection title="Portada en buscadores" description="Título y descripción de la página de inicio. Los productos y las categorías tienen los suyos.">
            <SeoFields
              value={{ title: v.seo.title, description: v.seo.description }}
              onChange={(patch) => {
                if (patch.title !== undefined) set("seo.title", patch.title);
                if (patch.description !== undefined) set("seo.description", patch.description);
              }}
              fallbackTitle={storeName}
              fallbackDescription={tagline}
              errors={{ title: error("seo.title"), description: error("seo.description") }}
            />
          </FormSection>

          <FormSection
            title="Imagen para compartir"
            description="La que aparece al compartir el link de la tienda por WhatsApp, Instagram o Facebook. Ideal 1200 × 630 px."
          >
            <Field label="URL de la imagen" error={error("seo.og_image_url")}>
              <Input type="url" value={v.seo.og_image_url} onChange={(e) => set("seo.og_image_url", e.target.value)} placeholder="https://…" />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => onFile(e.target.files?.[0])} />
              <Button icon={<ImageUp />} onClick={() => fileRef.current?.click()} loading={uploading}>
                Subir imagen
              </Button>
              {v.seo.og_image_url ? (
                <Button variant="ghost" icon={<Trash2 />} onClick={() => set("seo.og_image_url", "")}>
                  Quitar
                </Button>
              ) : null}
            </div>
            {v.seo.og_image_url && /^https?:\/\//.test(v.seo.og_image_url) ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa de una URL arbitraria
              <img
                src={v.seo.og_image_url}
                alt="Vista previa de la imagen para compartir"
                className="aspect-[1200/630] w-full max-w-[420px] rounded-adm border border-adm-border object-cover"
              />
            ) : null}
          </FormSection>

          <FormSection
            title="Medición y publicidad"
            description="Pegá sólo los IDs: la tienda carga los códigos y envía los eventos de vista de producto, carrito, inicio de compra y compra."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Google Analytics 4" hint="ID de medición: G-XXXXXXXXXX." error={error("integrations.ga4_id")}>
                <Input value={v.integrations.ga4_id} onChange={(e) => set("integrations.ga4_id", e.target.value)} placeholder="G-XXXXXXXXXX" className="font-mono" spellCheck={false} />
              </Field>
              <Field label="Google Tag Manager" hint="ID del contenedor: GTM-XXXXXXX." error={error("integrations.gtm_id")}>
                <Input value={v.integrations.gtm_id} onChange={(e) => set("integrations.gtm_id", e.target.value)} placeholder="GTM-XXXXXXX" className="font-mono" spellCheck={false} />
              </Field>
              <Field label="Meta Pixel" hint="Sólo números (Administrador de eventos de Meta)." error={error("integrations.meta_pixel_id")}>
                <Input
                  value={v.integrations.meta_pixel_id}
                  onChange={(e) => set("integrations.meta_pixel_id", e.target.value)}
                  inputMode="numeric"
                  placeholder="123456789012345"
                  className="font-mono"
                />
              </Field>
              <Field label="Verificación de Google Search Console" hint="El código o la etiqueta meta completa: nos quedamos con el código." error={error("integrations.google_site_verification")}>
                <Input
                  value={v.integrations.google_site_verification}
                  onChange={(e) => set("integrations.google_site_verification", e.target.value)}
                  className="font-mono"
                  spellCheck={false}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Mantenimiento" description="Cierra la tienda temporalmente con un mensaje. Siguen accesibles las páginas de pedidos y las políticas.">
            <div id="mantenimiento" className="space-y-4 scroll-mt-20">
              <Switch
                checked={v.maintenance.enabled}
                onCheckedChange={(on) => set("maintenance.enabled", on)}
                label="Activar modo mantenimiento"
                description="Mientras esté activo nadie puede comprar."
              />
              <Field label="Mensaje para los visitantes" error={error("maintenance.message")}>
                <Textarea rows={2} value={v.maintenance.message} onChange={(e) => set("maintenance.message", e.target.value)} maxLength={300} />
              </Field>
            </div>
          </FormSection>
          <button type="submit" hidden />
        </form>
      </Card>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} errorCount={Object.keys(form.errors).length} />
    </>
  );
}
