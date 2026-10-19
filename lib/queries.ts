import 'server-only';
import { createClient } from './supabase/server';

export const COURSE_CARD = 'id, slug, title, subtitle, cover_url, price_ars, hours, category, owner:profiles(full_name, role)';

type Owner = { full_name: string; role: string } | null;
export const teacherName = (owner: unknown) => {
  const o = (Array.isArray(owner) ? owner[0] : owner) as Owner;
  return o && o.role !== 'admin' ? o.full_name : 'HUEHACI';
};

export async function publishedCourses(opts: { q?: string; category?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from('courses').select(COURSE_CARD).eq('status', 'publicado').order('created_at', { ascending: false });
  if (opts.q) query = query.or(`title.ilike.%${opts.q.replace(/[%,()]/g, ' ')}%,subtitle.ilike.%${opts.q.replace(/[%,()]/g, ' ')}%`);
  if (opts.category) query = query.eq('category', opts.category);
  if (opts.limit) query = query.limit(opts.limit);
  const { data } = await query;
  return data ?? [];
}
