'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

export async function updateProfile(formData: FormData) {
  const { user, supabase } = await requireUser('/mi-cuenta');
  const full_name = String(formData.get('full_name') || '').trim();
  if (full_name.length < 3) redirect(`/mi-cuenta?error=${encodeURIComponent('El nombre es muy corto')}`);
  await supabase.from('profiles').update({
    full_name,
    bio: String(formData.get('bio') || '').trim() || null,
    avatar_url: String(formData.get('avatar_url') || '').trim() || null,
  }).eq('id', user.id);
  revalidatePath('/mi-cuenta');
  redirect('/mi-cuenta?ok=1');
}

export async function requestTeacher() {
  const { user, supabase } = await requireUser('/mi-cuenta');
  await supabase.from('profiles').update({ teacher_request: true }).eq('id', user.id);
  revalidatePath('/mi-cuenta');
  redirect('/mi-cuenta?ok=solicitud');
}
