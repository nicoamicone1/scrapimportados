import { cn } from "@/lib/cn";
import { sanitizeHtml } from "@/lib/html";

import type { BlockProps } from "./types";

/** Texto enriquecido (DESIGN.md §6.9): `.prose-store` con las fuentes del tema; HTML saneado. */
export function RichText({ block }: BlockProps<"rich_text">) {
  const s = block.settings;
  const html = sanitizeHtml(s.html);
  if (!html.trim()) return null;
  return (
    <div
      className={cn(
        "prose-store",
        s.maxWidth === "narrow" && "max-w-[60ch]",
        s.maxWidth === "full" && "max-w-none",
        s.align === "center" && "mx-auto text-center",
        s.align === "right" && "ml-auto text-right",
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
