"use client";

import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useId, useState, type KeyboardEvent, type Ref } from "react";

import { Segmented } from "@/components/admin/builder/fields";
import { PLAN_PAGE } from "@/components/admin/PlanGate";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/cn";
import { featureMinPlan, PLAN_NAMES, type PlanInfo } from "@/lib/plans";
import { isPresetAllowed } from "@/lib/schemas/appearance";
import { isDarkTheme, PRESET_LIST, PRESETS, type PresetId, type PresetMeta } from "@/lib/theme";

import { EMPTY_PRESET_FILTER, filterPresets, type PresetFilter, type PresetTone } from "./preset-filter";
import { PresetThumb } from "./PresetThumb";

/*
 * Selector de presets del editor de apariencia (modo "Elegir preset").
 *
 * Reemplaza al formulario angosto con una grilla ancha de miniaturas fieles
 * (PresetThumb) y deja la vista previa real a la derecha: tocar una tarjeta
 * la PRUEBA en la vista previa sin tocar el tema; aplicarla es un paso
 * aparte (toolbar de la vista previa, o la fila de acciones de la tarjeta en
 * pantallas angostas). Todo sale de PRESET_LIST / PRESETS: funciona igual
 * con 5 o con 10 presets.
 */

export type PresetKey = Exclude<PresetId, "custom">;

/** Estado de un preset respecto del tema que se está editando. */
export type PresetStatus = "current" | "base" | "locked" | "available";

export function presetMeta(id: PresetKey | null | undefined): PresetMeta | undefined {
  return id ? PRESET_LIST.find((p) => p.id === id) : undefined;
}

export function presetStatus(
  id: PresetKey,
  { current, base, plan }: { current: PresetKey | null; base: PresetKey | null; plan: Pick<PlanInfo, "features"> | null },
): PresetStatus {
  if (current === id) return "current";
  if (plan && !isPresetAllowed(plan, id)) return "locked";
  if (base === id) return "base";
  return "available";
}

const LOCK_PLAN = () => PLAN_NAMES[featureMinPlan("theme.all_presets")];

/**
 * Acción principal sobre un preset que se está probando. La usan la toolbar
 * de la vista previa y la tarjeta seleccionada (mismo texto en los dos).
 */
export function PresetApplyAction({
  id,
  status,
  onApply,
  className,
}: {
  id: PresetKey;
  status: PresetStatus;
  onApply: (id: PresetKey) => void;
  className?: string;
}) {
  const name = presetMeta(id)?.name ?? id;
  if (status === "current") {
    return <span className={cn("text-xs text-adm-fg-muted", className)}>Es el que estás usando.</span>;
  }
  if (status === "locked") {
    return (
      <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
        <span className="text-xs text-adm-fg-muted">Para publicarlo necesitás el plan {LOCK_PLAN()}.</span>
        <ButtonLink href={PLAN_PAGE} size="sm">
          Ver planes
        </ButtonLink>
      </span>
    );
  }
  return (
    <Button size="sm" variant="primary" className={className} onClick={() => onApply(id)}>
      {status === "base" ? `Restablecer ${name}` : `Aplicar ${name}`}
    </Button>
  );
}

function PresetOption({
  meta,
  brand,
  status,
  selected,
  onTry,
  onApply,
}: {
  meta: PresetMeta;
  brand: string;
  status: PresetStatus;
  selected: boolean;
  onTry: () => void;
  onApply: (id: PresetKey) => void;
}) {
  const descId = useId();
  return (
    <li
      className={cn(
        "flex flex-col rounded-adm border bg-adm-surface transition-colors",
        selected ? "border-adm-accent ring-1 ring-adm-accent" : "border-adm-border hover:border-adm-input-border-hover",
      )}
    >
      <button
        type="button"
        onClick={onTry}
        aria-pressed={selected}
        aria-current={status === "current" ? "true" : undefined}
        aria-label={`Probar ${meta.name} en la vista previa`}
        aria-describedby={descId}
        className="flex flex-1 flex-col rounded-adm text-left"
      >
        <PresetThumb theme={PRESETS[meta.id]} brand={brand} headline={meta.mood} labels={meta.industries} className="rounded-t-[5px]" />
        <span id={descId} className="flex flex-1 flex-col gap-1.5 border-t border-adm-border px-3 pt-2.5 pb-3">
          <span className="flex min-h-5 items-center gap-2">
            <span className="text-[13px] font-semibold text-adm-fg">{meta.name}</span>
            {status === "current" ? <Badge tone="accent">En uso</Badge> : null}
            {status === "base" ? <Badge tone="neutral">Base de tu tema</Badge> : null}
            {status === "locked" ? (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-adm-fg-muted">
                <Lock className="size-4" strokeWidth={1.75} aria-hidden />
                Plan {LOCK_PLAN()}
              </span>
            ) : null}
          </span>
          <span className="sr-only">Tono: {meta.mood}.</span>
          <span className="line-clamp-2 text-xs text-adm-fg-muted">{meta.description}</span>
          {meta.industries.length ? (
            <span className="mt-auto flex flex-wrap gap-1 pt-0.5">
              {meta.industries.map((ind) => (
                <span key={ind} className="rounded-adm-sm bg-adm-surface-2 px-1.5 py-px text-xs text-adm-fg-muted">
                  {ind}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>
      {selected ? (
        // En pantallas anchas la acción vive en la toolbar de la vista previa, al lado.
        <div className="flex items-center gap-2 border-t border-adm-border px-3 py-2 xl:hidden">
          <PresetApplyAction id={meta.id} status={status} onApply={onApply} />
        </div>
      ) : null}
    </li>
  );
}

export interface PresetGalleryProps {
  /** Nombre de la tienda para el logo de las miniaturas. */
  brand: string;
  current: PresetKey | null;
  base: PresetKey | null;
  trial: PresetKey | null;
  plan: Pick<PlanInfo, "features"> | null;
  onTry: (id: PresetKey | null) => void;
  onApply: (id: PresetKey) => void;
  onClose: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}

export function PresetGallery({ brand, current, base, trial, plan, onTry, onApply, onClose, headingRef }: PresetGalleryProps) {
  const [filter, setFilter] = useState<PresetFilter>(EMPTY_PRESET_FILTER);
  const headingId = useId();

  const isDark = (id: PresetKey) => isDarkTheme(PRESETS[id]);
  const isAllowed = (id: PresetKey) => !plan || isPresetAllowed(plan, id);
  const darkCount = PRESET_LIST.filter((p) => isDark(p.id)).length;
  const lockedCount = PRESET_LIST.filter((p) => !isAllowed(p.id)).length;
  const showTone = darkCount > 0 && darkCount < PRESET_LIST.length;

  const list = filterPresets(PRESET_LIST, filter, { isDark, isAllowed });
  const filtered = list.length !== PRESET_LIST.length;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    // Esc en el buscador con texto: primero limpia la búsqueda.
    if (e.target instanceof HTMLInputElement && e.target.type === "search" && filter.query) {
      setFilter((f) => ({ ...f, query: "" }));
      return;
    }
    if (trial) onTry(null);
    else onClose();
  };

  return (
    <div onKeyDown={onKeyDown} role="region" aria-labelledby={headingId}>
      <div className="flex h-12 items-center border-b border-adm-border px-2">
        <Button size="sm" variant="ghost" icon={<ArrowLeft />} onClick={onClose}>
          Volver al editor
        </Button>
      </div>

      <div className="space-y-3 px-4 pt-4 pb-5">
        <div>
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-base font-semibold text-adm-fg outline-none">
            Elegí un preset
          </h2>
          <p className="mt-0.5 text-xs text-adm-fg-muted">
            Tocá uno para verlo con tus productos en la vista previa. Nada cambia hasta que lo apliques; aplicarlo reemplaza todo el tema menos el CSS
            personalizado.
          </p>
        </div>

        <div className="space-y-3">
          <SearchInput
            value={filter.query}
            onChange={(query) => setFilter((f) => ({ ...f, query }))}
            placeholder="Rubro o estilo: ropa, ferretería, cálido…"
            aria-label="Buscar presets por rubro o estilo"
            className="sm:w-full"
          />
          {showTone || lockedCount ? (
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              {showTone ? (
                <div className="w-full max-w-[280px]">
                  <Segmented<PresetTone>
                    label="Fondo"
                    value={filter.tone}
                    onChange={(tone) => setFilter((f) => ({ ...f, tone }))}
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "light", label: "Claro" },
                      { value: "dark", label: "Oscuro" },
                    ]}
                  />
                </div>
              ) : null}
              {lockedCount ? (
                <Checkbox
                  checked={filter.onlyAllowed}
                  onChange={(e) => setFilter((f) => ({ ...f, onlyAllowed: e.target.checked }))}
                  label="Sólo los de mi plan"
                  className="pb-1.5"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="text-xs text-adm-fg-muted" aria-live="polite">
          {filtered ? `${list.length} de ${PRESET_LIST.length} presets` : `${PRESET_LIST.length} presets`}
        </p>

        {list.length ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
            {list.map((p) => (
              <PresetOption
                key={p.id}
                meta={p}
                brand={brand}
                status={presetStatus(p.id, { current, base, plan })}
                selected={trial === p.id}
                onTry={() => onTry(trial === p.id ? null : p.id)}
                onApply={onApply}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-adm border border-adm-border px-4 py-5">
            <p className="text-sm font-medium text-adm-fg">
              {filter.query.trim() ? `Ningún preset coincide con «${filter.query.trim()}».` : "Ningún preset coincide con estos filtros."}
            </p>
            <p className="mt-1 text-xs text-adm-fg-muted">Probá con otra palabra o mirá todos: cualquier preset se ajusta después en las otras secciones.</p>
            <Button size="sm" className="mt-3" onClick={() => setFilter(EMPTY_PRESET_FILTER)}>
              Ver todos los presets
            </Button>
          </div>
        )}

        {lockedCount ? (
          <p className="flex items-start gap-1.5 text-xs text-adm-fg-muted">
            <Lock className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span>
              Los que tienen candado se pueden probar en la vista previa; para publicarlos necesitás el plan {LOCK_PLAN()}.{" "}
              <Link href={PLAN_PAGE} className="font-medium text-adm-accent underline-offset-2 hover:underline">
                Ver planes
              </Link>
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
