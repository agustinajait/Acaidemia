'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvePaymentAndEnroll } from '@/lib/enrollment';
import { linkedinUrl, mediaOf } from '@/lib/media';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function approveTransfer(formData: FormData) {
  const { user } = await requireRole(['admin'], '/admin');
  await approvePaymentAndEnroll(str(formData, 'id'), { reviewed_by: user.id, admin_notes: str(formData, 'notes') || null });
  revalidatePath('/admin');
  redirect('/admin?ok=1');
}

export async function rejectTransfer(formData: FormData) {
  const { user } = await requireRole(['admin'], '/admin');
  const db = createAdminClient();
  await db.from('payments').update({
    status: 'rechazado', reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    admin_notes: str(formData, 'notes') || 'El comprobante no coincide con el monto o no se encontró la transferencia.',
  }).eq('id', str(formData, 'id')).neq('status', 'aprobado');
  revalidatePath('/admin');
  redirect('/admin?ok=1');
}

export async function reviewCourse(formData: FormData) {
  const { supabase } = await requireRole(['admin'], '/admin');
  const decision = str(formData, 'decision');
  await supabase.from('courses').update({
    status: decision === 'publicar' ? 'publicado' : 'borrador',
    review_notes: str(formData, 'notes') || null,
  }).eq('id', str(formData, 'id'));
  revalidatePath('/admin');
  revalidatePath('/cursos');
  redirect('/admin?tab=cursos&ok=1');
}

export async function decideTeacher(formData: FormData) {
  await requireRole(['admin'], '/admin');
  const db = createAdminClient();
  const approve = str(formData, 'decision') === 'aprobar';
  await db.from('profiles').update({ teacher_request: false, ...(approve ? { role: 'docente' } : {}) }).eq('id', str(formData, 'id'));
  revalidatePath('/admin');
  redirect('/admin?tab=docentes&ok=1');
}

export async function saveSettings(formData: FormData) {
  const { supabase } = await requireRole(['admin'], '/admin');
  const pct = Number(str(formData, 'commission_pct'));
  await supabase.from('settings').update({
    commission_pct: pct >= 0 && pct <= 100 ? pct : 20,
    bank_holder: str(formData, 'bank_holder'),
    bank_cuit: str(formData, 'bank_cuit'),
    bank_cbu: str(formData, 'bank_cbu'),
    bank_alias: str(formData, 'bank_alias'),
    bank_name: str(formData, 'bank_name'),
    transfer_notes: str(formData, 'transfer_notes'),
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  revalidatePath('/admin');
  redirect('/admin?tab=config&ok=1');
}

// ---------- Especialistas (directorio público) ----------
export async function saveSpecialist(formData: FormData) {
  await requireRole(['admin'], '/admin');
  const db = createAdminClient();
  const id = str(formData, 'id');
  const back = (msg: string) => redirect(`/admin?tab=especialistas&error=${encodeURIComponent(msg)}${id ? `&editar=${id}` : ''}#form-especialista`);

  const full_name = str(formData, 'full_name');
  if (!full_name) back('Poné el nombre del/la especialista');
  const photoRaw = str(formData, 'photo_url');
  const photo = mediaOf(photoRaw);
  if (photoRaw && (!photo || photo.kind !== 'image')) back('La foto tiene que ser una imagen (link https a JPG, PNG o WebP)');
  const liRaw = str(formData, 'linkedin_url');
  const linkedin = linkedinUrl(liRaw);
  if (liRaw && !linkedin) back('El link de LinkedIn no es válido (tiene que ser de linkedin.com)');

  const fields = {
    full_name,
    category: str(formData, 'category'),
    bio: str(formData, 'bio'),
    photo_url: photoRaw || null,
    linkedin_url: linkedin,
    position: Math.round(Number(str(formData, 'position') || 0)) || 0,
    published: formData.get('published') === 'on',
    updated_at: new Date().toISOString(),
  };
  const { error } = id
    ? await db.from('specialists').update(fields).eq('id', id)
    : await db.from('specialists').insert(fields);
  if (error) back(error.message);
  revalidatePath('/especialistas');
  revalidatePath('/admin');
  redirect('/admin?tab=especialistas&ok=1');
}

export async function deleteSpecialist(formData: FormData) {
  await requireRole(['admin'], '/admin');
  const db = createAdminClient();
  await db.from('specialists').delete().eq('id', str(formData, 'id'));
  revalidatePath('/especialistas');
  redirect('/admin?tab=especialistas&ok=1');
}
