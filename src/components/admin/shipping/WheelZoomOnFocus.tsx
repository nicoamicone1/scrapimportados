"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * La rueda del mouse hace zoom sólo después de hacer click (o foco) en el
 * mapa: así scrollear el formulario no mueve el mapa sin querer.
 */
export function WheelZoomOnFocus() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const enable = () => map.scrollWheelZoom.enable();
    const disable = () => map.scrollWheelZoom.disable();
    el.addEventListener("focus", enable);
    el.addEventListener("pointerdown", enable);
    el.addEventListener("blur", disable);
    el.addEventListener("mouseleave", disable);
    return () => {
      el.removeEventListener("focus", enable);
      el.removeEventListener("pointerdown", enable);
      el.removeEventListener("blur", disable);
      el.removeEventListener("mouseleave", disable);
    };
  }, [map]);
  return null;
}
