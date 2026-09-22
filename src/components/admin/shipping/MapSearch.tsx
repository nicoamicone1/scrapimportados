"use client";

import { MapPin, Search } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

import { fetchPlaces, type PlaceResult } from "./map-shared";

/**
 * Buscador de lugares (Nominatim vía /api/geocode). Al elegir un resultado
 * llama `onSelect` (el mapa se centra ahí).
 */
export function MapSearch({
  onSelect,
  placeholder = "Buscá un barrio, ciudad o dirección",
  className,
}: {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setError("Escribí al menos 3 letras.");
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const found = await fetchPlaces(q);
      setResults(found);
      if (found.length === 0) setError("No encontramos ese lugar. Probá con el barrio o la ciudad.");
      else if (found.length === 1) pick(found[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos buscar.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const pick = (place: PlaceResult) => {
    onSelect(place);
    setResults(null);
    setError(null);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          size="sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void run();
            }
            if (e.key === "Escape") setResults(null);
          }}
          placeholder={placeholder}
          aria-label="Buscar un lugar en el mapa"
          aria-controls={results?.length ? listId : undefined}
          leading={<Search aria-hidden />}
          className="min-w-0 flex-1"
        />
        <Button size="md" onClick={() => void run()} loading={loading}>
          Buscar
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-adm-fg-muted">{error}</p> : null}
      {results && results.length > 1 ? (
        <ul
          id={listId}
          className="absolute inset-x-0 top-9 z-[1000] mt-1 overflow-hidden rounded-adm border border-adm-border bg-adm-surface p-1 shadow-[var(--adm-shadow)]"
        >
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-start gap-2 rounded-[4px] px-2 py-1.5 text-left text-[13px] hover:bg-adm-surface-2 focus-visible:bg-adm-surface-2"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-adm-fg-muted" aria-hidden />
                <span className="line-clamp-2">{r.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
