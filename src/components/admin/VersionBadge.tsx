"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import { APP_NAME, APP_VERSION } from "@/lib/version";

/*
 * Versión de Ecommy en el pie del sidebar. Muestra un punto "Novedades"
 * cuando hay una versión que el usuario todavía no abrió en /admin/changelog
 * (se recuerda por navegador en localStorage).
 */

const KEY = "ecommy:changelog-seen";
const EVENT = "ecommy:changelog-seen";

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return APP_VERSION; // sin storage: no molestar con el punto
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function VersionBadge({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const seen = useSyncExternalStore(subscribe, readSeen, () => APP_VERSION);
  const unseen = seen !== APP_VERSION;
  return (
    <Link
      href="/admin/changelog"
      onClick={onNavigate}
      className={cn("tnum inline-flex items-center gap-1.5 text-xs text-adm-fg-muted hover:text-adm-fg hover:underline", className)}
      title={unseen ? "Hay novedades: ver el changelog" : "Ver novedades"}
    >
      {APP_NAME} {APP_VERSION}
      {unseen ? (
        <>
          <span aria-hidden className="size-1.5 rounded-full bg-adm-accent" />
          <span className="sr-only">(hay novedades)</span>
        </>
      ) : null}
    </Link>
  );
}

/** Se monta en /admin/changelog: marca la versión actual como vista. */
export function MarkChangelogSeen() {
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, APP_VERSION);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // sin storage: nada que recordar
    }
  }, []);
  return null;
}
