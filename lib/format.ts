export const ars = (n: number) =>
  Number(n) === 0
    ? 'Gratis'
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n));

export const fecha = (d: string | Date) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(d));

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function slugify(s: string) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/** Convierte un link de YouTube/Vimeo en URL embebible; otro link se devuelve tal cual. */
export function embedUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').pop();
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com') && !u.hostname.startsWith('player')) return `https://player.vimeo.com/video${u.pathname}`;
    return url;
  } catch {
    return null;
  }
}

export const statusLabel: Record<string, string> = {
  borrador: 'Borrador', en_revision: 'En revisión', publicado: 'Publicado', archivado: 'Archivado',
  pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado',
  mercadopago: 'Mercado Pago', transferencia: 'Transferencia', gratis: 'Gratis',
  alumno: 'Alumno/a', docente: 'Docente', admin: 'Admin',
};

/** Opciones máximas por pregunta en el editor de la evaluación final. */
export const QUIZ_OPTION_SLOTS = 5;
