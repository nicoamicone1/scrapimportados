import { cn } from "@/lib/cn";

/** Luminancia relativa aproximada de un #RRGGBB (para bordes y texto encima). */
export function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const v = Number.parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}

/** Muestra de color de filamento: disco plano, con borde si el color es muy claro (blanco, transparente). */
export function Swatch({
  hex,
  size = 16,
  className,
  title,
  muted,
}: {
  hex: string;
  size?: number;
  className?: string;
  title?: string;
  /** Color desactivado: se ve tachado. */
  muted?: boolean;
}) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn(
        "relative inline-block shrink-0 rounded-full",
        isLightHex(hex) ? "ring-1 ring-adm-input-border ring-inset" : "",
        muted && "opacity-45",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: hex }}
    >
      {muted ? (
        <span aria-hidden className="absolute top-1/2 left-[-2px] h-px w-[calc(100%+4px)] -rotate-45 bg-adm-fg-muted" />
      ) : null}
    </span>
  );
}
