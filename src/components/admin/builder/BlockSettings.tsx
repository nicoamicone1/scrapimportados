"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import type { ReactNode } from "react";

import { parseVideoUrl } from "@/components/blocks/video-url";
import { RichTextEditor } from "@/components/admin/products/RichTextEditor";
import { Field } from "@/components/ui/Field";
import { BLOCK_META } from "@/lib/blocks/defaults";
import type { BannerItem, Block, BlockOf, BlockStyle, BlockType } from "@/lib/blocks/schema";

import {
  ColorField,
  CtaField,
  ImageField,
  ItemsEditor,
  LinkInput,
  Note,
  NumberField,
  RangeField,
  Section,
  Segmented,
  SelectField,
  TextField,
  ToggleField,
  Warning,
} from "./fields";
import { CategoryIdsField, DateTimeField, IconPicker, ProductSourceField, useBuilderOptions } from "./pickers";

/*
 * Panel derecho del builder: formularios tipados por tipo de bloque +
 * sección "Estilo". Todo es controlado: `onChange(block)` devuelve el bloque
 * completo actualizado.
 */

type Props<T extends BlockType> = { block: BlockOf<T>; set: (patch: Partial<BlockOf<T>["settings"]>) => void };

const ALIGN3 = [
  { value: "left" as const, label: <AlignLeft aria-hidden />, title: "Izquierda" },
  { value: "center" as const, label: <AlignCenter aria-hidden />, title: "Centro" },
  { value: "right" as const, label: <AlignRight aria-hidden />, title: "Derecha" },
];

function HeroForm({ block, set }: Props<"hero">) {
  const s = block.settings;
  const { links } = useBuilderOptions();
  return (
    <>
      <Section title="Imagen">
        <ImageField label="Imagen" value={s.imageUrl} onChange={(imageUrl) => set({ imageUrl })} hint="Horizontal, mínimo 1600 px de ancho. Sin texto incrustado." />
        <ImageField
          label="Imagen para celulares"
          optional
          aspect="4 / 5"
          frameClassName="w-36"
          value={s.imageUrlMobile ?? ""}
          onChange={(v) => set({ imageUrlMobile: v || undefined })}
          hint="Vertical 4:5. Si no la cargás, se recorta la principal."
        />
        <TextField label="Descripción de la foto" value={s.imageAlt ?? ""} onChange={(v) => set({ imageAlt: v || undefined })} maxLength={200} hint="Para lectores de pantalla y Google. Si es de un banco de imágenes, sumá el crédito." />
        <RangeField label="Oscurecer la foto" value={s.overlay} min={0} max={80} onChange={(overlay) => set({ overlay })} />
        {s.imageUrl && s.overlay < 25 ? <Warning>El texto puede no leerse sobre la foto. Subí el oscurecido a 25 % o más.</Warning> : null}
      </Section>
      <Section title="Texto">
        <TextField label="Línea chica arriba" value={s.eyebrow ?? ""} onChange={(v) => set({ eyebrow: v || undefined })} placeholder="Temporada otoño" maxLength={120} />
        <TextField label="Título" value={s.title} onChange={(title) => set({ title })} maxLength={200} multiline rows={2} hint="Concreto: qué vendés y por qué ahora." />
        <TextField label="Bajada" value={s.subtitle} onChange={(subtitle) => set({ subtitle })} maxLength={500} multiline rows={2} />
        <Segmented label="Alineación" value={s.align} onChange={(align) => set({ align })} options={ALIGN3.filter((o) => o.value !== "right")} />
        <Segmented
          label="Alto"
          value={s.height}
          onChange={(height) => set({ height })}
          options={[
            { value: "sm", label: "Bajo" },
            { value: "md", label: "Medio" },
            { value: "lg", label: "Alto" },
            { value: "screen", label: "Pantalla" },
          ]}
        />
      </Section>
      <Section title="Botones">
        <CtaField label="Botón principal" value={s.cta} onChange={(cta) => set({ cta: cta ?? { label: "", href: "" } })} suggestions={links} />
        <CtaField label="Link secundario" optional value={s.cta2} onChange={(cta2) => set({ cta2 })} suggestions={links} hint="Se muestra como link subrayado, no como botón." />
      </Section>
    </>
  );
}

function ProductListFields({ block, set }: Props<"product_slider"> | Props<"product_grid">) {
  const s = block.settings;
  const { links } = useBuilderOptions();
  const setAny = set as (patch: Partial<BlockOf<"product_slider">["settings"]>) => void;
  return (
    <>
      <Section title="Título">
        <TextField label="Título" value={s.title} onChange={(title) => setAny({ title })} maxLength={200} />
        <TextField label="Bajada" value={s.subtitle ?? ""} onChange={(v) => setAny({ subtitle: v || undefined })} maxLength={500} />
        <Field label="Link «Ver todo»" hint="Vacío = sin link.">
          <LinkInput value={s.viewAllHref ?? ""} onChange={(v) => setAny({ viewAllHref: v || undefined })} suggestions={links} />
        </Field>
      </Section>
      <Section title="Productos">
        <ProductSourceField
          value={s.source}
          onChange={(source) => setAny({ source })}
          limitHint={block.type === "product_grid" && block.settings.rows ? "La cantidad de filas manda sobre este número." : undefined}
        />
      </Section>
    </>
  );
}

function SliderForm(props: Props<"product_slider">) {
  const { block, set } = props;
  return (
    <>
      <ProductListFields {...props} />
      <Section title="Diseño">
        <Segmented
          label="Productos visibles en computadora"
          value={block.settings.cardsPerView}
          onChange={(cardsPerView) => set({ cardsPerView })}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
          hint="En celulares se ven 2 y un poco del tercero."
        />
      </Section>
    </>
  );
}

function GridForm(props: Props<"product_grid">) {
  const { block, set } = props;
  const s = block.settings;
  return (
    <>
      <ProductListFields {...props} />
      <Section title="Diseño">
        <Segmented
          label="Columnas en computadora"
          value={s.columns}
          onChange={(columns) => set({ columns })}
          options={[2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
          hint="En celulares y tablets se usan las columnas del tema."
        />
        <ToggleField
          label="Limitar por filas"
          description={s.rows ? `${s.rows} filas = ${s.rows * s.columns} productos` : "Muestra la cantidad máxima de la fuente."}
          checked={Boolean(s.rows)}
          onChange={(on) => set({ rows: on ? 2 : undefined })}
        />
        {s.rows ? <NumberField label="Filas" value={s.rows} min={1} max={12} onChange={(rows) => set({ rows })} /> : null}
      </Section>
    </>
  );
}

function BannerItemFields({ item, update, columns }: { item: BannerItem; update: (patch: Partial<BannerItem>) => void; columns: number }) {
  const { links } = useBuilderOptions();
  return (
    <>
      <ImageField label="Imagen" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} aspect={columns === 1 ? "21 / 9" : "4 / 3"} />
      {columns === 1 ? (
        <ImageField label="Imagen para celulares" optional aspect="4 / 5"
          frameClassName="w-36" value={item.imageUrlMobile ?? ""} onChange={(v) => update({ imageUrlMobile: v || undefined })} />
      ) : null}
      <TextField label="Título" value={item.title ?? ""} onChange={(v) => update({ title: v || undefined })} maxLength={120} />
      <TextField label="Bajada" value={item.subtitle ?? ""} onChange={(v) => update({ subtitle: v || undefined })} maxLength={200} />
      <CtaField label="Llamado a la acción" optional value={item.cta} onChange={(cta) => update({ cta })} suggestions={links} hint="Todo el banner es clickeable." />
      <Segmented label="Alineación del texto" value={item.align} onChange={(align) => update({ align })} options={ALIGN3} />
      <Segmented
        label="Color del texto"
        value={item.textColor}
        onChange={(textColor) => update({ textColor })}
        options={[
          { value: "light", label: "Claro" },
          { value: "dark", label: "Oscuro" },
        ]}
      />
      <RangeField
        label={item.textColor === "light" ? "Oscurecer la foto" : "Aclarar la foto"}
        value={item.overlay}
        min={0}
        max={80}
        onChange={(overlay) => update({ overlay })}
        hint={columns >= 3 ? "En 0, el texto va debajo de la foto." : undefined}
      />
    </>
  );
}

function BannerForm({ block, set }: Props<"banner_grid">) {
  const s = block.settings;
  return (
    <>
      <Section title="Diseño">
        <Segmented
          label="Columnas"
          value={s.columns}
          onChange={(columns) => set({ columns })}
          options={[
            { value: 1, label: "1" },
            { value: 2, label: "2" },
            { value: 3, label: "3" },
            { value: 4, label: "4" },
          ]}
          hint={s.columns === 1 ? "Banner de campaña a lo ancho." : s.columns === 2 ? "Mitad y mitad." : "Accesos a categorías o colecciones."}
        />
        <SelectField
          label="Proporción de las imágenes"
          value={s.ratio}
          onChange={(ratio) => set({ ratio })}
          options={[
            { value: "auto", label: "Automática según columnas" },
            { value: "21:9", label: "21:9 (panorámica)" },
            { value: "16:9", label: "16:9" },
            { value: "4:5", label: "4:5 (vertical)" },
            { value: "1:1", label: "1:1 (cuadrada)" },
          ]}
        />
        {s.ratio === "auto" && s.items.length === 3 && s.columns >= 2 ? <Note>Con 3 banners y proporción automática: uno grande y dos apilados.</Note> : null}
        <Segmented
          label="Separación"
          value={s.gap}
          onChange={(gap) => set({ gap })}
          options={[
            { value: "none", label: "Sin" },
            { value: "sm", label: "Chica" },
            { value: "md", label: "Normal" },
          ]}
        />
      </Section>
      <Section title="Banners">
        <ItemsEditor
          items={s.items}
          onChange={(items) => set({ items })}
          max={12}
          addLabel="Agregar banner"
          create={(): BannerItem => ({ imageUrl: "", title: "", align: "left", overlay: s.columns >= 3 ? 0 : 30, textColor: "light" })}
          itemTitle={(item) => item.title || (item.imageUrl ? "Banner sin título" : "")}
          renderItem={(item, update) => <BannerItemFields item={item} update={update} columns={s.columns} />}
        />
      </Section>
    </>
  );
}

function RichTextForm({ block, set }: Props<"rich_text">) {
  const s = block.settings;
  return (
    <Section title="Texto">
      <Field label="Contenido">
        <RichTextEditor value={s.html} onChange={(html) => set({ html })} placeholder="Escribí el texto. Usá títulos para ordenar." />
      </Field>
      <Segmented label="Alineación" value={s.align} onChange={(align) => set({ align })} options={ALIGN3} />
      <Segmented
        label="Ancho del texto"
        value={s.maxWidth}
        onChange={(maxWidth) => set({ maxWidth })}
        options={[
          { value: "narrow", label: "Angosto" },
          { value: "normal", label: "Normal" },
          { value: "full", label: "Completo" },
        ]}
        hint="Para leer cómodo, 60 a 70 caracteres por línea."
      />
    </Section>
  );
}

function HeadingForm({ block, set }: Props<"heading">) {
  const s = block.settings;
  return (
    <Section title="Título">
      <TextField label="Línea chica arriba" value={s.eyebrow ?? ""} onChange={(v) => set({ eyebrow: v || undefined })} maxLength={120} />
      <TextField label="Título" value={s.text} onChange={(text) => set({ text })} maxLength={300} multiline rows={2} />
      <Segmented
        label="Tamaño"
        value={s.level}
        onChange={(level) => set({ level })}
        options={[
          { value: 1, label: "Grande (H1)" },
          { value: 2, label: "Sección (H2)" },
          { value: 3, label: "Chico (H3)" },
        ]}
        hint={s.level === 1 ? "Usá un solo H1 por página." : undefined}
      />
      <Segmented label="Alineación" value={s.align} onChange={(align) => set({ align })} options={ALIGN3} />
    </Section>
  );
}

function ImageTextForm({ block, set }: Props<"image_text">) {
  const s = block.settings;
  const { links } = useBuilderOptions();
  return (
    <>
      <Section title="Imagen">
        <ImageField label="Imagen" value={s.imageUrl} onChange={(imageUrl) => set({ imageUrl })} aspect="4 / 3" />
        <Segmented
          label="Posición de la imagen"
          value={s.imagePosition}
          onChange={(imagePosition) => set({ imagePosition })}
          options={[
            { value: "left", label: "Izquierda" },
            { value: "right", label: "Derecha" },
          ]}
          hint="En celulares la imagen va siempre arriba."
        />
      </Section>
      <Section title="Texto">
        <TextField label="Título" value={s.title} onChange={(title) => set({ title })} maxLength={200} />
        <Field label="Texto">
          <RichTextEditor value={s.html} onChange={(html) => set({ html })} placeholder="Contá la historia en dos o tres párrafos." />
        </Field>
        <CtaField label="Botón" optional value={s.cta} onChange={(cta) => set({ cta })} suggestions={links} />
      </Section>
    </>
  );
}

function CategoryListForm({ block, set }: Props<"category_list">) {
  const s = block.settings;
  return (
    <>
      <Section title="Contenido">
        <TextField label="Título" value={s.title ?? ""} onChange={(v) => set({ title: v || undefined })} maxLength={200} />
        <CategoryIdsField value={s.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
      </Section>
      <Section title="Diseño">
        <Segmented
          label="Estilo"
          value={s.style}
          onChange={(style) => set({ style })}
          options={[
            { value: "cards", label: "Tarjetas" },
            { value: "chips", label: "Chips" },
            { value: "circles", label: "Círculos" },
          ]}
          hint={s.style === "circles" ? "Muestra la foto de cada categoría (o de su primer producto) en un círculo." : undefined}
        />
        {s.style === "cards" ? (
          <Segmented
            label="Columnas en computadora"
            value={Math.min(s.columns, 6)}
            onChange={(columns) => set({ columns })}
            options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
          />
        ) : null}
      </Section>
    </>
  );
}

function FeaturesForm({ block, set }: Props<"features">) {
  const s = block.settings;
  return (
    <>
      <Section title="Beneficios">
        <ItemsEditor
          items={s.items}
          onChange={(items) => set({ items })}
          max={4}
          addLabel="Agregar beneficio"
          create={() => ({ icon: "Truck", title: "", text: "" })}
          itemTitle={(i) => i.title}
          renderItem={(item, update) => (
            <>
              <IconPicker value={item.icon} onChange={(icon) => update({ icon })} />
              <TextField label="Título" value={item.title} onChange={(title) => update({ title })} maxLength={120} placeholder="Envíos a todo el país" />
              <TextField label="Texto" value={item.text} onChange={(text) => update({ text })} maxLength={500} multiline rows={2} placeholder="Despachamos en 24 a 48 hs hábiles." />
            </>
          )}
        />
        <Note>Datos concretos que ayuden a comprar: envíos, retiro, formas de pago, cambios.</Note>
      </Section>
      <Section title="Diseño">
        <Segmented
          label="Columnas en computadora"
          value={s.columns}
          onChange={(columns) => set({ columns })}
          options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
        />
      </Section>
    </>
  );
}

function FaqForm({ block, set }: Props<"faq">) {
  const s = block.settings;
  return (
    <Section title="Preguntas">
      <TextField label="Título" value={s.title ?? ""} onChange={(v) => set({ title: v || undefined })} maxLength={200} />
      <ItemsEditor
        items={s.items}
        onChange={(items) => set({ items })}
        max={50}
        addLabel="Agregar pregunta"
        create={() => ({ q: "", a: "" })}
        itemTitle={(i) => i.q}
        renderItem={(item, update) => (
          <>
            <TextField label="Pregunta" value={item.q} onChange={(q) => update({ q })} maxLength={300} />
            <TextField label="Respuesta" value={item.a} onChange={(a) => update({ a })} maxLength={5000} multiline rows={4} />
          </>
        )}
      />
    </Section>
  );
}

function CountdownForm({ block, set }: Props<"countdown">) {
  const s = block.settings;
  const { links } = useBuilderOptions();
  return (
    <>
      <Section title="Cuenta regresiva">
        <TextField label="Título" value={s.title} onChange={(title) => set({ title })} maxLength={200} />
        <TextField label="Texto" value={s.text ?? ""} onChange={(v) => set({ text: v || undefined })} maxLength={500} multiline rows={2} />
        <DateTimeField label="Termina el" value={s.endsAt} onChange={(endsAt) => set({ endsAt })} />
        <CtaField label="Botón" optional value={s.cta} onChange={(cta) => set({ cta })} suggestions={links} />
      </Section>
      <Section title="Cuando termina">
        <TextField
          label="Texto de cierre"
          value={s.expiredText ?? ""}
          onChange={(v) => set({ expiredText: v || undefined })}
          maxLength={500}
          multiline
          rows={2}
          hint="Vacío = el bloque desaparece al terminar."
        />
      </Section>
    </>
  );
}

function TestimonialsForm({ block, set }: Props<"testimonials">) {
  const s = block.settings;
  return (
    <Section title="Reseñas">
      <Warning>Usá sólo reseñas reales, con permiso de quien la escribió. Inventar reseñas engaña a tus clientes y puede traerte problemas legales.</Warning>
      <ItemsEditor
        items={s.items}
        onChange={(items) => set({ items })}
        max={24}
        addLabel="Agregar reseña"
        create={(): BlockOf<"testimonials">["settings"]["items"][number] => ({ quote: "", author: "" })}
        itemTitle={(i) => (i.author ? `${i.author}: ${i.quote}` : i.quote)}
        empty="Sin reseñas, el bloque no se muestra en la tienda."
        renderItem={(item, update) => (
          <>
            <TextField label="Reseña" value={item.quote} onChange={(quote) => update({ quote })} maxLength={1000} multiline rows={3} />
            <TextField label="Nombre" value={item.author} onChange={(author) => update({ author })} maxLength={120} placeholder="Laura, de Rosario" />
            <TextField label="Detalle" value={item.meta ?? ""} onChange={(v) => update({ meta: v || undefined })} maxLength={120} placeholder="Compró una mesa de lapacho" />
          </>
        )}
      />
    </Section>
  );
}

function VideoForm({ block, set }: Props<"video">) {
  const s = block.settings;
  const valid = !s.url || parseVideoUrl(s.url) !== null;
  return (
    <Section title="Video">
      <TextField
        label="Link del video"
        value={s.url}
        onChange={(url) => set({ url: url.trim() })}
        placeholder="https://www.youtube.com/watch?v=…"
        error={valid ? null : "No reconocemos ese link. Pegá uno de YouTube, Vimeo o un archivo .mp4."}
        hint="YouTube, Vimeo o un .mp4. Se carga recién cuando tocan play."
      />
      <Segmented
        label="Proporción"
        value={s.ratio}
        onChange={(ratio) => set({ ratio })}
        options={[
          { value: "16:9", label: "16:9" },
          { value: "4:3", label: "4:3" },
          { value: "1:1", label: "1:1" },
          { value: "9:16", label: "9:16" },
        ]}
      />
    </Section>
  );
}

function DividerForm({ block, set }: Props<"divider">) {
  const s = block.settings;
  return (
    <Section title="Separador">
      <Segmented
        label="Tipo"
        value={s.style}
        onChange={(style) => set({ style })}
        options={[
          { value: "line", label: "Línea" },
          { value: "space", label: "Espacio" },
        ]}
      />
      <Segmented
        label="Tamaño"
        value={s.size}
        onChange={(size) => set({ size })}
        options={[
          { value: "sm", label: "Chico" },
          { value: "md", label: "Medio" },
          { value: "lg", label: "Grande" },
        ]}
      />
    </Section>
  );
}

function StyleForm({ style, onChange, type }: { style: BlockStyle; onChange: (s: BlockStyle) => void; type: BlockType }) {
  const set = (patch: Partial<BlockStyle>) => onChange({ ...style, ...patch });
  return (
    <Section title="Estilo">
      <SelectField
        label="Fondo"
        value={style.background}
        onChange={(background) => set({ background, customBg: background === "custom" ? style.customBg ?? "#F2F2F0" : undefined })}
        options={[
          { value: "default", label: "El de la página" },
          { value: "surface", label: "Superficie (apenas distinto)" },
          { value: "primary", label: "Color primario" },
          { value: "custom", label: "Otro color" },
        ]}
      />
      {style.background === "custom" ? <ColorField label="Color de fondo" value={style.customBg ?? ""} onChange={(customBg) => set({ customBg })} /> : null}
      <Segmented
        label="Espacio arriba y abajo"
        value={style.paddingY}
        onChange={(paddingY) => set({ paddingY })}
        options={[
          { value: "none", label: "Sin" },
          { value: "sm", label: "Chico" },
          { value: "md", label: "Medio" },
          { value: "lg", label: "Grande" },
        ]}
        hint="Variá el espacio entre bloques: pegá los relacionados y separá los distintos."
      />
      <Segmented
        label="Ancho"
        value={style.container}
        onChange={(container) => set({ container })}
        options={[
          { value: "full", label: "Completo" },
          { value: "normal", label: "Normal" },
          { value: "narrow", label: "Angosto" },
        ]}
        hint={style.container === "full" && type !== "hero" && type !== "banner_grid" ? "A lo ancho conviene sólo para portadas, banners y bandas de color." : undefined}
      />
      <ToggleField label="Ocultar en celulares" checked={Boolean(style.hideOnMobile)} onChange={(hideOnMobile) => set({ hideOnMobile: hideOnMobile || undefined })} />
      <ToggleField
        label="Ocultar el bloque"
        description="No se muestra en la tienda, pero queda guardado."
        checked={Boolean(style.hidden)}
        onChange={(hidden) => set({ hidden: hidden || undefined })}
      />
    </Section>
  );
}

function renderForm(block: Block, onChange: (b: Block) => void): ReactNode {
  const make =
    <T extends BlockType>(b: BlockOf<T>) =>
    (patch: Partial<BlockOf<T>["settings"]>) =>
      onChange({ ...b, settings: { ...b.settings, ...patch } } as Block);
  switch (block.type) {
    case "hero":
      return <HeroForm block={block} set={make(block)} />;
    case "product_slider":
      return <SliderForm block={block} set={make(block)} />;
    case "product_grid":
      return <GridForm block={block} set={make(block)} />;
    case "banner_grid":
      return <BannerForm block={block} set={make(block)} />;
    case "rich_text":
      return <RichTextForm block={block} set={make(block)} />;
    case "heading":
      return <HeadingForm block={block} set={make(block)} />;
    case "image_text":
      return <ImageTextForm block={block} set={make(block)} />;
    case "category_list":
      return <CategoryListForm block={block} set={make(block)} />;
    case "features":
      return <FeaturesForm block={block} set={make(block)} />;
    case "faq":
      return <FaqForm block={block} set={make(block)} />;
    case "countdown":
      return <CountdownForm block={block} set={make(block)} />;
    case "testimonials":
      return <TestimonialsForm block={block} set={make(block)} />;
    case "video":
      return <VideoForm block={block} set={make(block)} />;
    case "divider":
      return <DividerForm block={block} set={make(block)} />;
  }
}

export function BlockSettings({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  return (
    <div key={block.id}>
      <p className="px-4 pt-3 text-xs text-adm-fg-muted">{BLOCK_META[block.type].description}</p>
      {renderForm(block, onChange)}
      <StyleForm style={block.style} type={block.type} onChange={(style) => onChange({ ...block, style } as Block)} />
    </div>
  );
}
