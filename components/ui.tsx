import Link from 'next/link';
import { ars, statusLabel } from '@/lib/format';
import { mediaOf } from '@/lib/media';

export function Flash({ ok, error, okText = 'Cambios guardados.' }: { ok?: string; error?: string; okText?: string }) {
  if (error) return <div className="flash error" role="alert">{error}</div>;
  if (ok) return <div className="flash ok" role="status">{ok.length > 12 ? ok : okText}</div>;
  return null;
}

const tone: Record<string, string> = {
  publicado: 'ok', aprobado: 'ok', en_revision: 'warn', pendiente: 'warn', rechazado: 'danger', archivado: '', borrador: '',
};
export function StatusBadge({ s }: { s: string }) {
  return <span className={`badge ${tone[s] ?? ''}`}>{statusLabel[s] ?? s}</span>;
}

/**
 * Portada del curso: imagen, video (se reproduce solo, sin sonido, en loop) o YouTube/Vimeo.
 * `full` es la versión grande de la página del curso: el video tiene controles y YouTube/Vimeo se embeben.
 */
export function Cover({ url, title, full = false }: { url: string | null; title: string; full?: boolean }) {
  const media = mediaOf(url);
  const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'con', 'a', 'al', 'un', 'una', 'por']);
  const words = title.split(/\s+/).filter(Boolean);
  const main = words.filter((w) => !STOP.has(w.toLowerCase()));
  const initials = (main.length ? main : words).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="cover">
      {!media ? (
        <span className="initials">{initials}</span>
      ) : media.kind === 'image' ? (
        <img src={media.src} alt="" loading={full ? undefined : 'lazy'} />
      ) : media.kind === 'video' ? (
        <video src={media.src} autoPlay muted loop playsInline preload="metadata" controls={full} aria-label={`Video de portada: ${title}`} />
      ) : full ? (
        <iframe src={media.embed} title={`Video: ${title}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      ) : media.kind === 'youtube' ? (
        <>
          <img src={media.thumb} alt="" loading="lazy" />
          <span className="play-badge" aria-hidden="true">▶</span>
        </>
      ) : (
        <>
          <span className="initials">{initials}</span>
          <span className="play-badge" aria-hidden="true">▶</span>
        </>
      )}
    </div>
  );
}

export function CourseCard({ c, teacher, index = 0 }: { c: { slug: string; title: string; subtitle: string | null; cover_url: string | null; price_ars: number; hours: number | null; category: string | null }; teacher?: string; index?: number }) {
  return (
    <Link href={`/cursos/${c.slug}`} className="course-card" style={{ '--i': index } as React.CSSProperties}>
      <Cover url={c.cover_url} title={c.title} />
      <div className="body">
        <div className="row small">
          {c.category && <span className="badge brand">{c.category}</span>}
          {c.hours && <span className="muted">{String(c.hours).replace('.', ',')} h</span>}
        </div>
        <h3>{c.title}</h3>
        {c.subtitle && <p className="muted small" style={{ margin: 0 }}>{c.subtitle}</p>}
        <div className="row between" style={{ marginTop: 'auto', paddingTop: 10 }}>
          <span className="small muted">{teacher ? `por ${teacher}` : ''}</span>
          <span className="price">{ars(c.price_ars)}</span>
        </div>
      </div>
    </Link>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="star-count" title={`${n} certificado${n === 1 ? '' : 's'}`}>
      ★ {n}
    </span>
  );
}
