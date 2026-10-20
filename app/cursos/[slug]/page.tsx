import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ars } from '@/lib/format';
import { Cover } from '@/components/ui';
import { Icon } from '@/components/icons';
import { RichText } from '@/components/rich-text';
import { teacherName } from '@/lib/queries';

export default async function CursoDetalle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await getSession();
  const { data: course } = await supabase
    .from('courses')
    .select('*, owner:profiles!courses_owner_id_fkey(id, full_name, role, bio)')
    .eq('slug', slug)
    .maybeSingle();
  if (!course) notFound();

  const [{ data: syllabus }, enrollment, { data: quizCount }] = await Promise.all([
    supabase.rpc('course_syllabus', { c: course.id }),
    user ? supabase.from('enrollments').select('user_id').eq('course_id', course.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc('course_quiz_count', { c: course.id }),
  ]);
  const hasQuiz = Number(quizCount ?? 0) > 0;
  const enrolled = !!enrollment.data;
  const owner = Array.isArray(course.owner) ? course.owner[0] : course.owner;
  const lessons = (syllabus ?? []) as { id: string; title: string }[];

  return (
    <div className="container section">
      {course.status !== 'publicado' && <div className="flash info">Vista previa: este curso todavía no está publicado.</div>}
      <div className="two-col">
        <div className="stack">
          {course.category && <span className="badge brand">{course.category}</span>}
          <h1>{course.title}</h1>
          {course.subtitle && <p className="muted" style={{ fontSize: '1.1rem' }}>{course.subtitle}</p>}
          <p className="small muted">
            Dictado por{' '}
            {owner?.role === 'admin' ? <strong>HUEHACI</strong> : <Link href={`/perfil/${owner?.id}`}><strong>{teacherName(owner)}</strong></Link>}
            {course.hours ? ` · ${String(course.hours).replace('.', ',')} horas` : ''} · {lessons.length} lecciones
          </p>
          <div className="card flat">
            <h2>Sobre el curso</h2>
            <RichText text={course.description || 'Sin descripción.'} />
          </div>
          <div className="card flat">
            <h2>Temario</h2>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              {lessons.map((l) => <li key={l.id} style={{ padding: '4px 0' }}>{l.title}</li>)}
            </ol>
            {hasQuiz && <p className="small row" style={{ margin: '12px 0 0', gap: 8 }}><Icon name="quiz" size={18} className="brand-ic" /><span><strong>Evaluación final</strong> ({Number(quizCount)} preguntas)</span></p>}
          </div>
        </div>

        <aside className="card" style={{ position: 'sticky', top: 84, padding: 0, overflow: 'hidden' }}>
          <Cover url={course.cover_url} title={course.title} full />
          <div style={{ padding: 20 }} className="stack">
            <div className="price" style={{ fontSize: '1.8rem' }}>{ars(course.price_ars)}</div>
            {enrolled ? (
              <Link href={`/aprender/${course.slug}`} className="btn block">Ir al curso</Link>
            ) : course.status === 'publicado' ? (
              <Link href={`/checkout/${course.id}`} className="btn block">{Number(course.price_ars) === 0 ? 'Inscribirme gratis' : 'Comprar curso'}</Link>
            ) : null}
            <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Acceso de por vida</li>
              <li>Certificado digital con QR {hasQuiz ? 'al completarlo y aprobar la evaluación final' : 'al completarlo'}</li>
              <li>+1 estrella en tu perfil público</li>
              <li>Pagá con Mercado Pago o transferencia</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
