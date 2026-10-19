'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/format';

const safeNext = (n: FormDataEntryValue | null) => {
  const s = String(n || '/');
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
};

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get('next'));
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  });
  if (error) redirect(`/ingresar?error=${encodeURIComponent('Email o contraseña incorrectos')}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get('next'));
  const full_name = String(formData.get('full_name') || '').trim();
  if (full_name.length < 3) redirect(`/registro?error=${encodeURIComponent('Ingresá tu nombre completo (así aparece en el certificado)')}`);
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
    options: {
      data: { full_name },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) redirect(`/registro?error=${encodeURIComponent(error.message)}`);
  if (!data.session) redirect(`/ingresar?ok=${encodeURIComponent('Te enviamos un mail para confirmar tu cuenta.')}`);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
