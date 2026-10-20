/** Qué tipo de portada es un link: imagen, video subido o video de YouTube/Vimeo. */
export type Media =
  | { kind: 'image'; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'youtube'; embed: string; thumb: string }
  | { kind: 'vimeo'; embed: string };

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

export function mediaOf(url: string | null | undefined): Media | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be'
      ? u.pathname.slice(1)
      : u.searchParams.get('v') || u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
    if (id && /^[\w-]{6,20}$/.test(id)) {
      return { kind: 'youtube', embed: `https://www.youtube.com/embed/${id}?rel=0`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.match(/(\d{6,})/)?.[1];
    if (id) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${id}` };
  }
  if (VIDEO_EXT.test(u.pathname)) return { kind: 'video', src: url };
  return { kind: 'image', src: url };
}

/** Tipos y tamaño permitidos para subir una portada (deben coincidir con el bucket "portadas"). */
export const COVER_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
export const COVER_MAX_MB = 50;
