"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import type { ParsedVideo } from "./video-url";

/**
 * Video con "facade": hasta que tocás play no se carga el iframe (YouTube
 * sin cookies / Vimeo). Nunca autoplay con sonido al cargar la página.
 */
export function VideoEmbed({ video, title }: { video: Exclude<ParsedVideo, null>; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (video.kind === "file") {
    return <video src={video.src} controls preload="metadata" playsInline aria-label={title} />;
  }

  if (playing) {
    const src =
      video.kind === "youtube"
        ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`
        : `https://player.vimeo.com/video/${video.id}?autoplay=1&dnt=1`;
    return (
      <iframe
        src={src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={`Reproducir: ${title}`} className="group cursor-pointer">
      {video.kind === "youtube" ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura remota de YouTube.
        <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-bg text-fg transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-fg"
      >
        <Play className="size-6 translate-x-px" strokeWidth={1.75} />
      </span>
    </button>
  );
}
