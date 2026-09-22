/** Reconoce URLs de YouTube, Vimeo o un archivo de video directo. */
export type ParsedVideo =
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string }
  | { kind: "file"; src: string }
  | null;

export function parseVideoUrl(raw: string): ParsedVideo {
  const url = raw.trim();
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{6,20}$/.test(id) ? { kind: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    const fromPath = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,20})/)?.[1];
    const id = v ?? fromPath;
    return id && /^[\w-]{6,20}$/.test(id) ? { kind: "youtube", id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{6,12})/)?.[1];
    return id ? { kind: "vimeo", id } : null;
  }
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "file", src: u.toString() };
  return null;
}
