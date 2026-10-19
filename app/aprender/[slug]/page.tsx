import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { embedUrl } from '@/lib/format';
import { toggleLesson } from '@/app/actions/learning';
import type { Lesson } from '@/lib/types';

export default async function Aprender({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ l?: string; certificado?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser(`/aprender/${slug}`);
  const { data: course } = await supabase.from('courses').select('id, slug, title, owner_id').eq('slug', slug).maybeSingle();
  if (!course) notFound();

  const isStaff = course.owner_id === user.id || profile.role === 'admin';
  const { data: enrollment } = await supabase.from('enrollments').select('user_id').eq('course_id', course.id).eq('user_id', user.id).maybeSingle();
  if (!enrollment && !isStaff) redirect(`/cursos/${slug}`);

  const [{ data: lessonsRaw }, { data: progress }, { data: cert }] = await Promise.all([
    supabase.from('lessons').select('*').eq('course_id', course.id).order('position').order('created_at'),
    supabase.from('lesson_progress').select('lesson_id').eq('user_id', user.id),
    supabase.from('certificates').select('code').eq('course_id', course.id).eq('user_id', user.id).maybeSingle(),
  ]);
  const lessons = (lessonsRaw ?? []) as Lesson[];
  const done = new Set((progress ?? []).map((p) => p.lesson_id));
  const completed = lessons.filter((l) => done.has(l.id)).length;
  const pct = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const current = lessons.find((l) => l.id === sp.l) ?? lessons.find((l) => !done.has(l.id)) ?? lessons[0];
  const idx = current ? lessons.indexOf(current) : -1;
  const next = idx >= 0 ? lessons[idx + 1] : undefined;
  const video = current?.video_url ? embedUrl(current.video_url) : null;

  return (
    <div className="container section">
      <Link href={`/cursos/${slug}`} className="small muted">← {course.title}</Link>
      {!enrollment && <div className="flash info" style={{ marginTop: 12 }}>Vista de docente/admin: el progreso no se guarda.</div>}

      {(sp.certificado || cert) && (
        <div className="celebrate" style={{ margin: '16px 0' }}>
          <div style={{ fontSize: '2.2rem' }}>⭐</div>
          <h2>{sp.certificado ? '¡Completaste el curso!' : 'Curso aprobado'}</h2>
          <p style={{ marginBottom: 14 }}>Tu certificado ya está disponible y sumaste una estrella a tu perfil.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn" href={`/api/certificados/${sp.certificado || cert?.code}`} target="_blank">Descargar certificado (PDF)</a>
            <Link className="btn secondary" href={`/perfil/${user.id}`}>Ver mi perfil</Link>
          </div>
        </div>
      )}

      <div className="learn" style={{ marginTop: 16 }}>
        <aside className="card flat" style={{ padding: 14 }}>
          <div style={{ padding: '4px 8px 12px' }}>
            <div className="row between small"><strong>Tu progreso</strong><span className="muted">{completed}/{lessons.length}</span></div>
            <div className="progress" style={{ marginTop: 8 }}><div style={{ width: `${pct}%` }} /></div>
          </div>
          <ul className="lesson-list">
            {lessons.map((l, i) => (
              <li key={l.id}>
                <Link href={`/aprender/${slug}?l=${l.id}`} className={l.id === current?.id ? 'active' : ''}>
                  <span className={`check ${done.has(l.id) ? 'done' : ''}`}>{done.has(l.id) ? '✓' : ''}</span>
                  <span>{i + 1}. {l.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <article className="stack">
          {!current ? (
            <div className="card flat muted">Este curso todavía no tiene lecciones.</div>
          ) : (
            <>
              <h1 style={{ fontSize: '1.7rem' }}>{current.title}</h1>
              {video && <iframe className="video" src={video} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={current.title} />}
              {current.content && <div className="card flat prose">{current.content}</div>}
              {enrollment && (
                <form action={toggleLesson} className="row between">
                  <input type="hidden" name="lesson_id" value={current.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="done" value={done.has(current.id) ? '1' : '0'} />
                  <input type="hidden" name="next" value={next?.id ?? current.id} />
                  {done.has(current.id) ? (
                    <>
                      <button className="btn secondary" type="submit">Marcar como no vista</button>
                      {next && <Link className="btn" href={`/aprender/${slug}?l=${next.id}`}>Siguiente lección →</Link>}
                    </>
                  ) : (
                    <button className="btn" type="submit">{next ? 'Completar y seguir →' : 'Completar lección'}</button>
                  )}
                </form>
              )}
            </>
          )}
        </article>
      </div>
    </div>
  );
}
