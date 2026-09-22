import { DEFAULT_TIMEZONE } from "@/lib/dates";

import { StoreButtonLink } from "./Button";
import { CountdownClock } from "./CountdownClock";
import type { BlockProps } from "./types";

/** "lunes 28/9 a las 23:59 h" en la zona horaria de la tienda. */
export function formatEnd(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")}/${get("month")} a las ${get("hour")}:${get("minute")} h`;
}

/**
 * Cuenta regresiva (DESIGN.md §6.12): números tabulares en la fuente de
 * títulos, sin tarjetitas por dígito. Al vencer muestra el texto de cierre
 * (o se oculta si no hay).
 */
export function Countdown({ block, ctx }: BlockProps<"countdown">) {
  const s = block.settings;
  const tz = ctx.timezone || DEFAULT_TIMEZONE;
  const now = (ctx.now ?? new Date()).getTime();
  const endLabel = `Hasta el ${formatEnd(s.endsAt, tz)}`;

  const cta = s.cta?.label ? (
    <div className="mt-6">
      <StoreButtonLink theme={ctx.theme} href={s.cta.href || "/productos"}>
        {s.cta.label}
      </StoreButtonLink>
    </div>
  ) : null;

  const expired = s.expiredText ? (
    <div>
      <p className="blk-title">{s.expiredText}</p>
      {cta}
    </div>
  ) : null;

  return (
    <div>
      <CountdownClock
        endsAt={s.endsAt}
        serverNow={now}
        endLabel={endLabel}
        expired={expired}
        before={
          <>
            <h2 className="blk-title">{s.title}</h2>
            {s.text ? <p className="mt-2 max-w-[60ch] text-fg-muted">{s.text}</p> : null}
          </>
        }
      >
        {cta}
      </CountdownClock>
    </div>
  );
}
