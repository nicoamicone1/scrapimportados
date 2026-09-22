"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Reloj de la cuenta regresiva. Arranca con el `serverNow` del render del
 * server (mismo markup en SSR e hidratación) y después corre con la hora
 * real. Al llegar a cero muestra `expired` (texto de cierre) o nada.
 */

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function CountdownClock({
  endsAt,
  serverNow,
  endLabel,
  expired,
  before,
  children,
}: {
  endsAt: string;
  serverNow: number;
  /** "Termina el lunes 28/09 a las 23:59 h". */
  endLabel: string;
  /** Contenido cuando terminó (null = el bloque desaparece). */
  expired: ReactNode;
  /** Título y bajada (sólo mientras corre). */
  before?: ReactNode;
  /** CTA que acompaña mientras corre. */
  children?: ReactNode;
}) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    // Primer tick en el próximo frame (no sincrónico en el effect).
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const remaining = end - now;
  if (!Number.isFinite(end) || remaining <= 0) return <>{expired}</>;

  const p = parts(remaining);
  const units = [
    { value: p.days, label: p.days === 1 ? "día" : "días", show: p.days > 0 },
    { value: p.hours, label: "horas", show: true },
    { value: p.minutes, label: "min", show: true },
    { value: p.seconds, label: "seg", show: true },
  ].filter((u) => u.show);

  return (
    <>
      {before}
      <div
        role="timer"
        aria-live="off"
        aria-label={`Faltan ${p.days} días, ${p.hours} horas y ${p.minutes} minutos`}
        className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 @3xl:gap-x-10"
      >
        {units.map((u, i) => (
          <div key={u.label} className="flex flex-col">
            <span className="heading blk-display tnum" style={{ lineHeight: 1 }}>
              {i === 0 && u.label.startsWith("d") ? u.value : pad(u.value)}
            </span>
            <span className="mt-2 text-xs tracking-[0.08em] text-fg-muted uppercase">{u.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-fg-muted">{endLabel}</p>
      {children}
    </>
  );
}
