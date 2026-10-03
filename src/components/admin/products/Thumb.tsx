import { ImageOff } from "lucide-react";

/** Miniatura cuadrada de producto (foto real o placeholder neutro). */
export function Thumb({ url, size = 48 }: { url: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-adm-border bg-adm-surface-2"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura del admin; next/image no aporta a 48px
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <ImageOff className="size-4 text-adm-fg-muted" aria-hidden />
      )}
    </span>
  );
}
