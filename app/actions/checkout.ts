'use server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvePaymentAndEnroll, splitAmount } from '@/lib/enrollment';
import { mpPreference } from '@/lib/mercadopago';
import { siteUrl } from '@/lib/format';

async function loadPurchasableCourse(courseId: string, userId: string) {
  const db = createAdminClient();
  const { data: course } = await db.from('courses').select('id, slug, title, price_ars, owner_id, status').eq('id', courseId).single();
  if (!course || course.status !== 'publicado') redirect('/cursos');
  const { data: enrolled } = await db.from('enrollments').select('user_id').eq('user_id', userId).eq('course_id', courseId).maybeSingle();
  if (enrolled) redirect(`/aprender/${course.slug}`);
  return { db, course };
}

export async function enrollFree(formData: FormData) {
  const courseId = String(formData.get('course_id'));
  const { user } = await requireUser(`/checkout/${courseId}`);
  const { db, course } = await loadPurchasableCourse(courseId, user.id);
  if (Number(course.price_ars) !== 0) redirect(`/checkout/${courseId}`);
  const { data: p, error } = await db.from('payments')
    .insert({ user_id: user.id, course_id: courseId, method: 'gratis', amount_ars: 0 })
    .select('id').single();
  if (error) throw error;
  await approvePaymentAndEnroll(p.id);
  redirect(`/aprender/${course.slug}`);
}

export async function payWithMercadoPago(formData: FormData) {
  const courseId = String(formData.get('course_id'));
  const { user } = await requireUser(`/checkout/${courseId}`);
  const { db, course } = await loadPurchasableCourse(courseId, user.id);
  const amount = Number(course.price_ars);
  const split = await splitAmount(course.owner_id, amount);

  const { data: payment, error } = await db.from('payments')
    .insert({
      user_id: user.id, course_id: courseId, method: 'mercadopago', amount_ars: amount,
      platform_fee_ars: split.platform, teacher_amount_ars: split.teacher,
    })
    .select('id').single();
  if (error) throw error;

  const base = siteUrl();
  const isPublic = base.startsWith('https://');
  const pref = await mpPreference().create({
    body: {
      items: [{ id: course.id, title: `Acaiidemia · ${course.title}`, quantity: 1, unit_price: amount, currency_id: 'ARS' }],
      payer: { email: user.email },
      external_reference: payment.id,
      back_urls: {
        success: `${base}/pago/resultado?p=${payment.id}`,
        pending: `${base}/pago/resultado?p=${payment.id}`,
        failure: `${base}/pago/resultado?p=${payment.id}`,
      },
      // MP solo acepta auto_return y notification_url con URLs públicas (https)
      ...(isPublic ? { auto_return: 'approved', notification_url: `${base}/api/mp/webhook` } : {}),
      statement_descriptor: 'ACAIIDEMIA',
    },
  });
  await db.from('payments').update({ mp_preference_id: pref.id }).eq('id', payment.id);
  redirect(pref.init_point!);
}

export async function startTransfer(formData: FormData) {
  const courseId = String(formData.get('course_id'));
  const { user } = await requireUser(`/checkout/${courseId}`);
  const { db, course } = await loadPurchasableCourse(courseId, user.id);

  // Reutiliza una transferencia pendiente para no duplicar
  const { data: open } = await db.from('payments').select('id')
    .eq('user_id', user.id).eq('course_id', courseId).eq('method', 'transferencia')
    .in('status', ['pendiente', 'en_revision']).maybeSingle();
  if (open) redirect(`/pago/transferencia/${open.id}`);

  const amount = Number(course.price_ars);
  const split = await splitAmount(course.owner_id, amount);
  const { data: payment, error } = await db.from('payments')
    .insert({
      user_id: user.id, course_id: courseId, method: 'transferencia', amount_ars: amount,
      platform_fee_ars: split.platform, teacher_amount_ars: split.teacher,
    })
    .select('id').single();
  if (error) throw error;
  redirect(`/pago/transferencia/${payment.id}`);
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function uploadReceipt(formData: FormData) {
  const paymentId = String(formData.get('payment_id'));
  const { user, supabase } = await requireUser(`/pago/transferencia/${paymentId}`);
  const file = formData.get('receipt') as File | null;
  const back = `/pago/transferencia/${paymentId}`;

  if (!file || file.size === 0) redirect(`${back}?error=${encodeURIComponent('Adjuntá el comprobante')}`);
  if (!ALLOWED.includes(file.type)) redirect(`${back}?error=${encodeURIComponent('Formato no admitido: subí JPG, PNG, WEBP o PDF')}`);
  if (file.size > 5 * 1024 * 1024) redirect(`${back}?error=${encodeURIComponent('El archivo supera 5 MB')}`);

  const db = createAdminClient();
  const { data: payment } = await db.from('payments').select('id, user_id, status').eq('id', paymentId).single();
  if (!payment || payment.user_id !== user.id || payment.status === 'aprobado') redirect('/mi-cuenta');

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${user.id}/${paymentId}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, file, { contentType: file.type });
  if (upErr) redirect(`${back}?error=${encodeURIComponent('No se pudo subir el archivo')}`);

  await db.from('payments').update({ receipt_path: path, status: 'en_revision', admin_notes: null }).eq('id', paymentId);
  redirect(`${back}?ok=1`);
}
