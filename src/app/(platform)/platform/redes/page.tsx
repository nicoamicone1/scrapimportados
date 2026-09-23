import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/platform/AppHeader";
import { CopyText } from "@/components/platform/CopyText";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import {
  CHANNEL_LABEL,
  FORMAT_LABEL,
  KIND_LABEL,
  RED_PIECES,
  TEMPLATE_LABEL,
  captionFor,
  fillText,
  fillValuesFrom,
  pendingTokens,
  redImageHref,
  slideTexts,
  type FillValues,
  type RedFormat,
  type RedPiece,
} from "@/content/redes";
import { cn } from "@/lib/cn";

import { platformPageGuard } from "../guard";

export const metadata: Metadata = { title: "Redes" };
export const dynamic = "force-dynamic";

type View = "todo" | RedFormat;

const VIEWS: { id: View; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "feed", label: FORMAT_LABEL.feed },
  { id: "story", label: FORMAT_LABEL.story },
];

const THUMB = 270;

/** "1, 4 y 22". */
function joinY(items: (string | number)[]): string {
  const s = items.map(String);
  return s.length > 1 ? `${s.slice(0, -1).join(", ")} y ${s[s.length - 1]}` : (s[0] ?? "");
}

/** Los campos a completar viajan en la URL de la galería como `P01.tiempo=18 min`. */
const fieldParam = (piece: RedPiece, key: string) => `${piece.id}.${key}`;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function RedesPage({ searchParams }: PageProps<"/platform/redes">) {
  const { user, profile } = await platformPageGuard("/platform/redes");
  const params = await searchParams;
  const rawView = one(params.formato);
  const view: View = rawView === "feed" || rawView === "story" ? rawView : "todo";

  const shown = RED_PIECES.filter((p) => view === "todo" || p.formats.includes(view));
  const groups = [
    { title: "Posts y reels", description: "SOCIAL-KIT §2. En los reels, la placa 1 es la portada y la miniatura del perfil.", pieces: shown.filter((p) => p.kind !== "historias") },
    { title: "Historias", description: "SOCIAL-KIT §3. Los stickers (link, encuesta, pregunta) se agregan en Instagram al publicar.", pieces: shown.filter((p) => p.kind === "historias") },
  ].filter((g) => g.pieces.length);

  const valuesFor = (piece: RedPiece) => fillValuesFrom(piece, (key) => one(params[fieldParam(piece, key)]));
  const toFill = RED_PIECES.filter((p) => p.fields?.length).length;

  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email ?? ""} isPlatformAdmin={profile.is_platform_admin} section="redes" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Redes</h1>
        <p className="mt-1 max-w-[68ch] text-sm text-adm-fg-muted">
          Las {RED_PIECES.length} piezas de <code className="font-mono text-[13px]">docs/SOCIAL-KIT.md</code>, dibujadas por Ecommy: descargá el PNG,
          copiá el texto y publicá. {toFill} tienen datos de una grabación o de tu audiencia para completar antes de publicar. En las placas verdes
          con un rectángulo crema pegás una captura real del panel o de la tienda.
        </p>

        <nav aria-label="Formato" className="mt-5 flex gap-5 border-b border-adm-border text-sm">
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <Link
                key={v.id}
                href={v.id === "todo" ? "/platform/redes" : `/platform/redes?formato=${v.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 pb-2",
                  active ? "border-adm-accent font-medium text-adm-fg" : "border-transparent text-adm-fg-muted hover:text-adm-fg",
                )}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>

        {groups.map((g) => (
          <section key={g.title} className="mt-8" aria-labelledby={`g-${g.title}`}>
            <h2 id={`g-${g.title}`} className="text-base font-semibold">
              {g.title} <span className="font-normal text-adm-fg-muted tnum">· {g.pieces.length}</span>
            </h2>
            <p className="mt-0.5 text-[13px] text-adm-fg-muted">{g.description}</p>
            <div className="mt-3 space-y-4">
              {g.pieces.map((piece) => (
                <PieceCard
                  key={piece.id}
                  piece={piece}
                  format={view === "todo" ? piece.formats[0] : view}
                  view={view}
                  values={valuesFor(piece)}
                  otherParams={Object.entries(params).filter(
                    ([k, v]) => /^[PH]\d{2}\./.test(k) && !k.startsWith(`${piece.id}.`) && typeof v === "string" && v,
                  ) as [string, string][]}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function PieceCard({
  piece,
  format,
  view,
  values,
  otherParams,
}: {
  piece: RedPiece;
  format: RedFormat;
  view: View;
  values: FillValues;
  otherParams: [string, string][];
}) {
  const alt: RedFormat | undefined = view === "todo" ? piece.formats.find((f) => f !== format) : undefined;
  const pendingAll = pendingTokens(
    [piece.hook, piece.caption ?? "", ...piece.slides.flatMap(slideTexts)].map((t) => fillText(piece, t, values)),
  );
  const h = format === "story" ? Math.round((THUMB * 1920) / 1080) : THUMB;
  const meta = [
    KIND_LABEL[piece.kind],
    joinY(piece.channels.map((c) => CHANNEL_LABEL[c])),
    piece.days.length ? `${piece.days.length > 1 ? "Días" : "Día"} ${joinY(piece.days)} del plan` : undefined,
  ].filter(Boolean);

  return (
    <article id={piece.id.toLowerCase()} className="scroll-mt-4 rounded-adm border border-adm-border bg-adm-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-adm-border px-4 py-2.5">
        <span className="font-mono text-xs text-adm-fg-muted">{piece.id}</span>
        <h3 className="text-[15px] font-semibold">{piece.name}</h3>
        <span className="text-[13px] text-adm-fg-muted">{meta.join(" · ")}</span>
        {pendingAll.length ? (
          <Badge tone="amber" className="ml-auto" title={pendingAll.join(", ")}>
            Completar antes de publicar
          </Badge>
        ) : piece.fields?.length ? (
          <Badge tone="green" className="ml-auto">
            Datos completos
          </Badge>
        ) : null}
      </header>

      <div className="flex flex-col gap-5 p-4 lg:flex-row">
        <ol className="flex min-w-0 snap-x gap-3 overflow-x-auto pb-2 lg:flex-1" aria-label={`Placas de ${piece.id}`}>
          {piece.slides.map((slide, i) => {
            const n = i + 1;
            const src = redImageHref(piece, { format, slide: n, values });
            return (
              <li key={n} className="shrink-0 snap-start" style={{ width: THUMB }}>
                <a href={src} target="_blank" rel="noopener" className="block">
                  {/* PNG generado por el route handler (con sesión): next/image no suma nada acá. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    width={THUMB}
                    height={h}
                    loading="lazy"
                    decoding="async"
                    alt={`${piece.id}, placa ${n} de ${piece.slides.length} (${TEMPLATE_LABEL[slide.template]}): ${fillText(piece, slide.template === "dato" ? slide.value : slide.title, values)}`}
                    className="block h-auto w-full rounded-adm-sm border border-adm-border bg-adm-surface-2"
                  />
                </a>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-adm-fg-muted tnum">
                    {piece.slides.length > 1 ? `${n} de ${piece.slides.length} · ` : ""}
                    {TEMPLATE_LABEL[slide.template]}
                  </span>
                  <span className="flex gap-3">
                    <a href={redImageHref(piece, { format, slide: n, values, download: true })} download className="font-medium text-adm-accent hover:underline">
                      Descargar PNG
                    </a>
                    {alt ? (
                      <a
                        href={redImageHref(piece, { format: alt, slide: n, values, download: true })}
                        download
                        className="text-adm-accent hover:underline"
                        title={`Descargar ${FORMAT_LABEL[alt]}`}
                      >
                        {alt === "story" ? "Vertical" : "Feed"}
                      </a>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex shrink-0 flex-col gap-3 text-[13px] lg:w-[360px]">
          <dl className="space-y-2.5">
            <div>
              <dt className="text-xs text-adm-fg-muted">Gancho</dt>
              <dd className="mt-0.5 text-sm font-medium">{fillText(piece, piece.hook, values)}</dd>
            </div>
            {piece.caption ? (
              <div>
                <dt className="text-xs text-adm-fg-muted">Texto del post</dt>
                <dd className="mt-0.5 leading-relaxed">{fillText(piece, piece.caption, values)}</dd>
              </div>
            ) : null}
            {piece.cta ? (
              <div>
                <dt className="text-xs text-adm-fg-muted">{piece.kind === "historias" ? "Sticker" : "CTA"}</dt>
                <dd className="mt-0.5">{piece.cta}</dd>
              </div>
            ) : null}
            {piece.hashtags.length ? (
              <div>
                <dt className="text-xs text-adm-fg-muted">Hashtags</dt>
                <dd className="mt-0.5 text-adm-accent">{piece.hashtags.join(" ")}</dd>
              </div>
            ) : null}
          </dl>

          {piece.check ? (
            <p className="rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2 leading-relaxed">
              <span className="font-medium">Antes de publicar: </span>
              {piece.check}
            </p>
          ) : null}

          {piece.fields?.length ? (
            <form action={`/platform/redes#${piece.id.toLowerCase()}`} className="space-y-2 rounded-adm border border-adm-border p-3">
              <p className="text-xs text-adm-fg-muted">Completá con el dato real y las placas y el texto se actualizan.</p>
              {view !== "todo" ? <input type="hidden" name="formato" value={view} /> : null}
              {otherParams.map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              {piece.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="text-xs font-medium">
                    {f.label} <span className="font-mono font-normal text-adm-fg-muted">{f.token}</span>
                  </span>
                  <input
                    name={fieldParam(piece, f.key)}
                    defaultValue={values[f.key] ?? ""}
                    placeholder={f.example ? `Ej.: ${f.example}` : undefined}
                    maxLength={60}
                    className="mt-1 h-8 w-full rounded-adm border border-adm-input-border bg-adm-surface px-2.5 text-sm"
                  />
                </label>
              ))}
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Aplicar
              </button>
            </form>
          ) : null}

          <div>
            <CopyText text={captionFor(piece, values)} ariaLabel={`Copiar texto de ${piece.id}`} />
          </div>
        </div>
      </div>
    </article>
  );
}
