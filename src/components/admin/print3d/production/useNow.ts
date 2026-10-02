"use client";

import { useEffect, useState } from "react";

/**
 * Reloj del tablero: arranca en la hora que mandó el server (sin mismatch de
 * hidratación) y avanza cada `everyMs` para que el "faltan 1 h 20 min" se
 * mueva solo en la pantalla que queda abierta todo el día.
 */
export function useNow(initialIso: string, everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date(initialIso));
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, everyMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [everyMs]);
  return now;
}
