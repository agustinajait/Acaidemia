'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvePaymentAndEnroll } from '@/lib/enrollment';

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
