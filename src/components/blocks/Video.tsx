import { parseVideoUrl } from "./video-url";
import { VideoEmbed } from "./VideoEmbed";
import type { BlockProps } from "./types";

const RATIO = { "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1", "9:16": "9 / 16" } as const;

/** Video de YouTube/Vimeo (carga diferida) o `<video>` para un .mp4. */
export function Video({ block }: BlockProps<"video">) {
  const s = block.settings;
  const video = parseVideoUrl(s.url);
  if (!video) return null;
  const vertical = s.ratio === "9:16";
  return (
    <div
      className="blk-video rounded-lg"
      style={{ aspectRatio: RATIO[s.ratio], maxWidth: vertical ? "420px" : undefined, marginInline: vertical ? "auto" : undefined }}
    >
      <VideoEmbed video={video} title="Video" />
    </div>
  );
}
