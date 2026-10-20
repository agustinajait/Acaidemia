import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { saveCourse, setCourseStatus, deleteCourse, saveLesson, deleteLesson, moveLesson, saveQuizSettings, saveQuizQuestion, deleteQuizQuestion } from '@/app/actions/teacher';
import { QUIZ_OPTION_SLOTS } from '@/lib/format';
import { Icon } from '@/components/icons';
import { CoverField } from '@/components/cover-field';
import { Flash, StatusBadge } from '@/components/ui';
import type { Course, Lesson, QuizQuestion } from '@/lib/types';

export const metadata = { title: 'Editar curso' };

export default async function EditarCurso({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase, profile } = await requireRole(['docente', 'admin'], '/docente');
  const isNew = id === 'nuevo';
  let course: Course | null = null;
  let lessons: Lesson[] = [];
  let questions: QuizQuestion[] = [];
  if (!isNew) {
    const { data } = await supabase.from('courses').select('*').eq('id', id).maybeSingle();
    if (!data) notFound();
    course = data as Course;
    const { data: ls } = await supabase.from('lessons').select('*').eq('course_id', id).order('position').order('created_at');
    lessons = (ls ?? []) as Lesson[];
    const { data: qs } = await supabase.from('quiz_questions').select('*').eq('course_id', id).order('position').order('created_at');
    questions = (qs ?? []) as QuizQuestion[];
  }
  const isAdmin = profile.role === 'admin';

  return (
    <div className="container section stack">
      <Link href="/docente" className="small muted">← Panel de especialista</Link>
      <div className="row between">
        <h1 style={{ margin: 0 }}>{isNew ? 'Nuevo curso' : course!.title}</h1>
        {course && <div className="row"><StatusBadge s={course.status} />{course.status === 'publicado' && <Link className="btn ghost sm" href={`/cursos/${course.slug}`}>Ver página</Link>}</div>}
      </div>
      <Flash ok={ok} error={error} />
      {course?.review_notes && course.status === 'borrador' && <div className="flash info"><strong>Devolución de la revisión:</strong> {course.review_notes}</div>}

      <div className="two-col">
        <div className="card">
          <h2>Datos del curso</h2>
          <form action={saveCourse}>
            <input type="hidden" name="id" value={course?.id ?? ''} />
            <div className="field"><label>Título</label><input type="text" name="title" defaultValue={course?.title} required /></div>
            <div className="field"><label>Bajada</label><input type="text" name="subtitle" defaultValue={course?.subtitle ?? ''} placeholder="Una frase que explique qué se aprende" /></div>
            <div className="field"><label>Descripción</label><textarea name="description" defaultValue={course?.description} rows={6} /></div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="field" style={{ flex: '1 1 140px' }}><label>Precio (ARS)</label><input type="number" name="price_ars" min={0} step="1" defaultValue={course?.price_ars ?? 0} /><div className="hint">0 = gratis</div></div>
              <div className="field" style={{ flex: '1 1 140px' }}><label>Horas</label><input type="number" name="hours" min={0} step="0.5" defaultValue={course?.hours ?? ''} /><div className="hint">Figura en el certificado</div></div>
              <div className="field" style={{ flex: '1 1 160px' }}><label>Categoría</label><input type="text" name="category" defaultValue={course?.category ?? ''} placeholder="Ej: Gestión pública" /></div>
            </div>
            <CoverField defaultValue={course?.cover_url ?? null} title={course?.title ?? ''} />
            {course?.status === 'publicado' && !isAdmin && <p className="hint">Al guardar cambios, el curso vuelve a revisión antes de republicarse.</p>}
            <button className="btn" type="submit">{isNew ? 'Crear curso' : 'Guardar'}</button>
          </form>
        </div>

        {course && (
          <div className="card stack">
            <h3>Publicación</h3>
            {isAdmin ? (
              <form action={setCourseStatus} className="row">
                <input type="hidden" name="id" value={course.id} />
                <select name="status" defaultValue={course.status} style={{ flex: 1 }}>
                  <option value="borrador">Borrador</option><option value="en_revision">En revisión</option>
                  <option value="publicado">Publicado</option><option value="archivado">Archivado</option>
                </select>
                <button className="btn sm" type="submit">Aplicar</button>
              </form>
            ) : course.status === 'borrador' ? (
              <form action={setCourseStatus}><input type="hidden" name="id" value={course.id} /><input type="hidden" name="status" value="en_revision" />
                <p className="small muted">Cuando esté listo, envialo a revisión. La administración lo publica.</p>
                <button className="btn block" type="submit">Enviar a revisión</button></form>
            ) : course.status === 'en_revision' ? (
              <p className="small muted">Está en revisión. Te avisamos acá cuando se publique o si hay que ajustar algo.</p>
            ) : course.status === 'publicado' ? (
              <form action={setCourseStatus}><input type="hidden" name="id" value={course.id} /><input type="hidden" name="status" value="archivado" />
                <p className="small muted">Archivarlo lo saca del catálogo; los alumnos inscriptos conservan el acceso.</p>
                <button className="btn secondary block" type="submit">Archivar</button></form>
            ) : (
              <form action={setCourseStatus}><input type="hidden" name="id" value={course.id} /><input type="hidden" name="status" value="borrador" />
                <button className="btn secondary block" type="submit">Volver a borrador</button></form>
            )}
            {(course.status === 'borrador' || isAdmin) && (
              <details><summary className="small">Eliminar curso</summary>
                <form action={deleteCourse} style={{ marginTop: 10 }}><input type="hidden" name="id" value={course.id} />
                  <button className="btn danger sm" type="submit">Eliminar definitivamente</button></form>
              </details>
            )}
          </div>
        )}
      </div>

      {course && (
        <section className="card" id="lecciones">
          <h2>Lecciones ({lessons.length})</h2>
          <p className="small muted">{questions.length ? 'El alumno obtiene el certificado al completar todas las lecciones y aprobar la evaluación final.' : 'El alumno obtiene el certificado al completar todas las lecciones.'}</p>
          <div className="stack">
            {lessons.map((l, i) => (
              <details key={l.id} className="card flat" style={{ padding: 14 }}>
                <summary>{i + 1}. {l.title}{l.video_url && <Icon name="video" size={16} className="inline-ic" label="Tiene video" />}</summary>
                <form action={saveLesson} style={{ marginTop: 14 }}>
                  <input type="hidden" name="course_id" value={course.id} /><input type="hidden" name="id" value={l.id} />
                  <div className="field"><label>Título</label><input type="text" name="title" defaultValue={l.title} required /></div>
                  <div className="field"><label>Video (YouTube, Vimeo o URL embebible)</label><input type="url" name="video_url" defaultValue={l.video_url ?? ''} /></div>
                  <div className="field"><label>Contenido</label><textarea name="content" defaultValue={l.content} rows={6} /></div>
                  <button className="btn sm" type="submit">Guardar lección</button>
                </form>
                <div className="row" style={{ marginTop: 10 }}>
                  {i > 0 && <form action={moveLesson}><input type="hidden" name="course_id" value={course.id} /><input type="hidden" name="id" value={l.id} /><input type="hidden" name="dir" value="up" /><button className="btn secondary sm">↑ Subir</button></form>}
                  {i < lessons.length - 1 && <form action={moveLesson}><input type="hidden" name="course_id" value={course.id} /><input type="hidden" name="id" value={l.id} /><input type="hidden" name="dir" value="down" /><button className="btn secondary sm">↓ Bajar</button></form>}
                  <form action={deleteLesson} style={{ marginLeft: 'auto' }}><input type="hidden" name="course_id" value={course.id} /><input type="hidden" name="id" value={l.id} /><button className="btn ghost sm" style={{ color: 'var(--danger)' }}>Eliminar</button></form>
                </div>
              </details>
            ))}
            <div className="card flat" style={{ padding: 16, background: 'var(--surface-2)' }}>
              <h3>Agregar lección</h3>
              <form action={saveLesson}>
                <input type="hidden" name="course_id" value={course.id} />
                <div className="field"><label>Título</label><input type="text" name="title" required /></div>
                <div className="field"><label>Video (opcional)</label><input type="url" name="video_url" placeholder="https://www.youtube.com/watch?v=…" /></div>
                <div className="field"><label>Contenido</label><textarea name="content" rows={5} /></div>
                <button className="btn" type="submit">+ Agregar</button>
              </form>
            </div>
          </div>
        </section>
      )}

      {course && (
        <section className="card" id="evaluacion">
          <h2>Evaluación final ({questions.length} {questions.length === 1 ? 'pregunta' : 'preguntas'})</h2>
          <p className="small muted">
            Opcional. Si cargás preguntas, el certificado solo se emite cuando el alumno completa las lecciones y aprueba con el mínimo que definas.
            Puede reintentar las veces que quiera; solo ve su nota, no cuáles respuestas eran correctas.
          </p>
          <form action={saveQuizSettings} className="row" style={{ alignItems: 'flex-end', marginBottom: 16 }}>
            <input type="hidden" name="course_id" value={course.id} />
            <div className="field" style={{ flex: '0 1 220px', margin: 0 }}>
              <label>Mínimo para aprobar (%)</label>
              <input type="number" name="quiz_pass_pct" min={1} max={100} step={1} defaultValue={course.quiz_pass_pct ?? 70} />
            </div>
            <button className="btn secondary sm" type="submit">Guardar mínimo</button>
          </form>
          <div className="stack">
            {questions.map((q, i) => (
              <details key={q.id} className="card flat" style={{ padding: 14 }}>
                <summary>{i + 1}. {q.prompt}</summary>
                <QuestionForm courseId={course.id} q={q} />
                <form action={deleteQuizQuestion} style={{ marginTop: 10 }}>
                  <input type="hidden" name="course_id" value={course.id} /><input type="hidden" name="id" value={q.id} />
                  <button className="btn ghost sm" style={{ color: 'var(--danger)' }}>Eliminar pregunta</button>
                </form>
              </details>
            ))}
            <div className="card flat" style={{ padding: 16, background: 'var(--surface-2)' }}>
              <h3>Agregar pregunta</h3>
              <QuestionForm courseId={course.id} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function QuestionForm({ courseId, q }: { courseId: string; q?: QuizQuestion }) {
  const slots = Math.max(QUIZ_OPTION_SLOTS, q?.options.length ?? 0);
  return (
    <form action={saveQuizQuestion} style={{ marginTop: q ? 14 : 0 }}>
      <input type="hidden" name="course_id" value={courseId} />
      {q && <input type="hidden" name="id" value={q.id} />}
      <div className="field"><label>Pregunta</label><textarea name="prompt" defaultValue={q?.prompt} rows={2} required style={{ minHeight: 60 }} /></div>
      <div className="field">
        <label>Opciones (marcá la correcta; dejá vacías las que no uses)</label>
        <div className="quiz-edit-options">
          {Array.from({ length: slots }, (_, i) => (
            <div key={i} className="quiz-edit-option">
              <input type="radio" name="correct" value={i} defaultChecked={q ? q.correct_index === i : i === 0} aria-label={`Opción ${i + 1} es la correcta`} />
              <input type="text" name={`option_${i}`} defaultValue={q?.options[i] ?? ''} placeholder={`Opción ${i + 1}`} required={i < 2} />
            </div>
          ))}
        </div>
      </div>
      <button className="btn sm" type="submit">{q ? 'Guardar pregunta' : '+ Agregar pregunta'}</button>
    </form>
  );
}
