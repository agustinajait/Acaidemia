'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { courseCompletion, issueCertificateIfComplete } from '@/lib/enrollment';
import { createAdminClient } from '@/lib/supabase/admin';

export async function toggleLesson(formData: FormData) {
  const lessonId = String(formData.get('lesson_id'));
  const done = formData.get('done') === '1';
  const slug = String(formData.get('slug'));
  const { user, supabase } = await requireUser(`/aprender/${slug}`);

  const { data: lesson } = await supabase.from('lessons').select('id, course_id').eq('id', lessonId).single();
  if (!lesson) redirect(`/aprender/${slug}`);

  if (done) {
    await supabase.from('lesson_progress').delete().eq('user_id', user.id).eq('lesson_id', lessonId);
  } else {
    await supabase.from('lesson_progress').upsert({ user_id: user.id, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true });
    const code = await issueCertificateIfComplete(user.id, lesson.course_id);
    if (code) {
      revalidatePath(`/aprender/${slug}`);
      redirect(`/aprender/${slug}?l=${lessonId}&certificado=${code}`);
    }
    // Terminó las lecciones pero falta la evaluación final: lo llevamos ahí
    const status = await courseCompletion(user.id, lesson.course_id);
    if (status.lessonsDone && status.hasQuiz && !status.quizPassed) {
      revalidatePath(`/aprender/${slug}`);
      redirect(`/aprender/${slug}?quiz=1`);
    }
  }
  const next = String(formData.get('next') || lessonId);
  revalidatePath(`/aprender/${slug}`);
  redirect(`/aprender/${slug}?l=${done ? lessonId : next}`);
}

/** Corrige la evaluación final en el servidor (las respuestas correctas nunca salen de acá). */
export async function submitQuiz(formData: FormData) {
  const slug = String(formData.get('slug'));
  const courseId = String(formData.get('course_id'));
  const base = `/aprender/${slug}?quiz=1`;
  const { user } = await requireUser(`/aprender/${slug}`);
  const db = createAdminClient();

  const [{ data: course }, { data: enrollment }, { data: questions }] = await Promise.all([
    db.from('courses').select('id, quiz_pass_pct').eq('id', courseId).eq('slug', slug).maybeSingle(),
    db.from('enrollments').select('user_id').eq('user_id', user.id).eq('course_id', courseId).maybeSingle(),
    db.from('quiz_questions').select('id, correct_index').eq('course_id', courseId),
  ]);
  if (!course || !enrollment || !questions?.length) redirect(`/aprender/${slug}`);

  const status = await courseCompletion(user.id, courseId);
  if (!status.lessonsDone) redirect(`${base}&error=${encodeURIComponent('Completá todas las lecciones antes de rendir la evaluación')}`);
  if (status.quizPassed) {
    const code = await issueCertificateIfComplete(user.id, courseId);
    redirect(code ? `/aprender/${slug}?certificado=${code}` : base);
  }

  let correct = 0;
  for (const q of questions) {
    const answer = formData.get(`q_${q.id}`);
    if (answer === null || answer === '') redirect(`${base}&error=${encodeURIComponent('Respondé todas las preguntas')}`);
    if (Number(answer) === q.correct_index) correct++;
  }
  const total = questions.length;
  const scorePct = Math.round((correct / total) * 100);
  const passed = scorePct >= course.quiz_pass_pct;

  const { error } = await db.from('quiz_attempts').insert({ user_id: user.id, course_id: courseId, correct, total, score_pct: scorePct, passed });
  if (error) redirect(`${base}&error=${encodeURIComponent('No pudimos guardar tu evaluación. Probá de nuevo.')}`);

  revalidatePath(`/aprender/${slug}`);
  if (passed) {
    const code = await issueCertificateIfComplete(user.id, courseId);
    if (code) redirect(`/aprender/${slug}?certificado=${code}`);
  }
  redirect(`${base}&nota=${scorePct}`);
}
