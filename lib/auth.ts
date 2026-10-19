import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Profile, Role } from './types';

export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return { supabase, user, profile: profile as Profile | null };
}

export async function requireUser(next = '/') {
  const s = await getSession();
  if (!s.user || !s.profile) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  return { ...s, user: s.user!, profile: s.profile! };
}

export async function requireRole(roles: Role[], next = '/') {
  const s = await requireUser(next);
  if (!roles.includes(s.profile.role)) redirect('/');
  return s;
}
