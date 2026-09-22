"use client";

import { useEffect } from "react";

import { track, trackOnce, type TrackEventName, type TrackPayload } from "@/lib/store/analytics";

/** Dispara un evento de analytics al montar (ej. `view_item` en la ficha, `purchase` en el pedido). */
export function TrackEvent({ event, payload, onceKey }: { event: TrackEventName; payload: TrackPayload; onceKey?: string }) {
  const serialized = JSON.stringify(payload);
  useEffect(() => {
    const data = JSON.parse(serialized) as TrackPayload;
    if (onceKey) trackOnce(onceKey, event, data);
    else track(event, data);
  }, [event, serialized, onceKey]);
  return null;
}
