import 'server-only';
import { createAdminClient } from './supabase/admin';

/** Calcula comisión: cursos de un admin (HUEHACI) quedan 100% para la plataforma. */
export async function splitAmount(courseOwnerId: string, amount: number) {
  const db = createAdminClient();
  const [{ data: owner }, { data: settings }] = await Promise.all([
    db.from('profiles').select('role').eq('id', courseOwnerId).single(),
    db.from('settings').select('commission_pct').eq('id', 1).single(),
  ]);
  if (owner?.role === 'admin') return { platform: amount, teacher: 0 };
  const pct = Number(settings?.commission_pct ?? 20) / 100;
  const platform = Math.round(amount * pct * 100) / 100;
  return { platform, teacher: Math.round((amount - platform) * 100) / 100 };
}

/**
 * Aprueba un pago e inscribe al alumno. Idempotente: si ya estaba aprobado no hace nada.
 * Se usa desde el webhook de Mercado Pago y desde la aprobación manual de transferencias.
 */
export async function approvePaymentAndEnroll(paymentId: string, extra: Record<string, unknown> = {}) {
  const db = createAdminClient();
  const { data: payment, error } = await db
    .from('payments')
    .update({ status: 'aprobado', reviewed_at: new Date().toISOString(), ...extra })
    .eq('id', paymentId)
    .neq('status', 'aprobado')
    .select('id, user_id, course_id')
    .maybeSingle();
  if (error) throw error;
  if (!payment) return false; // ya estaba aprobado o no existe

  const { error: enrollErr } = await db
    .from('enrollments')
    .upsert({ user_id: payment.user_id, course_id: payment.course_id, payment_id: payment.id }, { onConflict: 'user_id,course_id', ignoreDuplicates: true });
  if (enrollErr) throw enrollErr;
  return true;
}

function newCode() {
  // 10 caracteres sin ambigüedades (sin 0/O, 1/I/L)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `ACA-${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Estado de cursada: lecciones completas y, si el curso tiene evaluación final, si la aprobó. */
export async function courseCompletion(userId: string, courseId: string) {
  const db = createAdminClient();
  const [{ data: lessons }, { count: quizTotal }, { data: passedAttempt }] = await Promise.all([
    db.from('lessons').select('id').eq('course_id', courseId),
    db.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
    db.from('quiz_attempts').select('id').eq('user_id', userId).eq('course_id', courseId).eq('passed', true).limit(1).maybeSingle(),
  ]);
  let lessonsDone = false;
  if (lessons?.length) {
    const { count } = await db
      .from('lesson_progress')
      .select('lesson_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('lesson_id', lessons.map((l) => l.id));
    lessonsDone = (count ?? 0) >= lessons.length;
  }
  return { lessonsDone, hasQuiz: (quizTotal ?? 0) > 0, quizPassed: !!passedAttempt };
}

/**
 * Emite el certificado si el alumno completó todas las lecciones y, cuando el curso
 * tiene evaluación final, la aprobó. Devuelve el código o null.
 */
export async function issueCertificateIfComplete(userId: string, courseId: string) {
  const db = createAdminClient();

  const { data: existing } = await db.from('certificates').select('code').eq('user_id', userId).eq('course_id', courseId).maybeSingle();
  if (existing) return existing.code as string;

  const { data: enrollment } = await db.from('enrollments').select('user_id').eq('user_id', userId).eq('course_id', courseId).maybeSingle();
  if (!enrollment) return null;
  const status = await courseCompletion(userId, courseId);
  if (!status.lessonsDone || (status.hasQuiz && !status.quizPassed)) return null;

  const [{ data: profile }, { data: course }] = await Promise.all([
    db.from('profiles').select('full_name').eq('id', userId).single(),
    db.from('courses').select('title, hours').eq('id', courseId).single(),
  ]);

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const { error } = await db.from('certificates').insert({
      code, user_id: userId, course_id: courseId,
      holder_name: profile?.full_name || 'Estudiante',
      course_title: course?.title || '',
      hours: course?.hours ?? null,
    });
    if (!error) return code;
    if (error.code === '23505' && error.message.includes('user_id')) {
      const { data } = await db.from('certificates').select('code').eq('user_id', userId).eq('course_id', courseId).single();
      return data?.code ?? null;
    }
    if (error.code !== '23505') throw error;
  }
  return null;
}
