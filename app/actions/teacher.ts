'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { slugify } from '@/lib/format';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const numOrNull = (f: FormData, k: string) => (str(f, k) === '' ? null : Number(str(f, k)));

export async function saveCourse(formData: FormData) {
  const { user, supabase, profile } = await requireRole(['docente', 'admin'], '/docente');
  const id = str(formData, 'id');
  const title = str(formData, 'title');
  if (title.length < 4) redirect(`/docente/cursos/${id || 'nuevo'}?error=${encodeURIComponent('Poné un título más descriptivo')}`);
  const price = Number(str(formData, 'price_ars') || 0);
  if (!(price >= 0)) redirect(`/docente/cursos/${id || 'nuevo'}?error=${encodeURIComponent('Precio inválido')}`);

  const fields = {
    title,
    subtitle: str(formData, 'subtitle') || null,
    description: str(formData, 'description'),
    category: str(formData, 'category') || null,
    cover_url: str(formData, 'cover_url') || null,
    hours: numOrNull(formData, 'hours'),
    price_ars: price,
  };

  if (!id) {
    const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from('courses').insert({ ...fields, slug, owner_id: user.id }).select('id').single();
    if (error) redirect(`/docente/cursos/nuevo?error=${encodeURIComponent(error.message)}`);
    redirect(`/docente/cursos/${data.id}?ok=1`);
  }

  // Un curso publicado de un docente vuelve a revisión al editarse (el admin edita sin restricción)
  const { data: current } = await supabase.from('courses').select('status').eq('id', id).single();
  const extra = profile.role !== 'admin' && current?.status === 'publicado' ? { status: 'en_revision' as const } : {};
  const { error } = await supabase.from('courses').update({ ...fields, ...extra }).eq('id', id);
  if (error) redirect(`/docente/cursos/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/docente/cursos/${id}`);
  redirect(`/docente/cursos/${id}?ok=1`);
}

export async function setCourseStatus(formData: FormData) {
  const { supabase, profile } = await requireRole(['docente', 'admin'], '/docente');
  const id = str(formData, 'id');
  const status = str(formData, 'status');
  const allowed = profile.role === 'admin' ? ['borrador', 'en_revision', 'publicado', 'archivado'] : ['borrador', 'en_revision', 'archivado'];
  if (!allowed.includes(status)) redirect(`/docente/cursos/${id}`);

  if (status === 'en_revision' || status === 'publicado') {
    const { count } = await supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', id);
    if (!count) redirect(`/docente/cursos/${id}?error=${encodeURIComponent('Agregá al menos una lección antes de enviar')}`);
  }
  const { error } = await supabase.from('courses').update({ status }).eq('id', id);
  if (error) redirect(`/docente/cursos/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/docente');
  redirect(`/docente/cursos/${id}?ok=1`);
}

export async function deleteCourse(formData: FormData) {
  const { supabase } = await requireRole(['docente', 'admin'], '/docente');
  const id = str(formData, 'id');
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) redirect(`/docente/cursos/${id}?error=${encodeURIComponent('Solo se pueden borrar cursos en borrador sin ventas')}`);
  redirect('/docente');
}

export async function saveLesson(formData: FormData) {
  const { supabase } = await requireRole(['docente', 'admin'], '/docente');
  const courseId = str(formData, 'course_id');
  const id = str(formData, 'id');
  const title = str(formData, 'title');
  if (!title) redirect(`/docente/cursos/${courseId}?error=${encodeURIComponent('La lección necesita título')}`);
  const fields = { title, video_url: str(formData, 'video_url') || null, content: str(formData, 'content') };

  if (id) {
    await supabase.from('lessons').update(fields).eq('id', id);
  } else {
    const { data: last } = await supabase.from('lessons').select('position').eq('course_id', courseId).order('position', { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from('lessons').insert({ ...fields, course_id: courseId, position: (last?.position ?? -1) + 1 });
    if (error) redirect(`/docente/cursos/${courseId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/docente/cursos/${courseId}`);
  redirect(`/docente/cursos/${courseId}?ok=1#lecciones`);
}

export async function deleteLesson(formData: FormData) {
  const { supabase } = await requireRole(['docente', 'admin'], '/docente');
  const courseId = str(formData, 'course_id');
  await supabase.from('lessons').delete().eq('id', str(formData, 'id'));
  revalidatePath(`/docente/cursos/${courseId}`);
  redirect(`/docente/cursos/${courseId}#lecciones`);
}

export async function moveLesson(formData: FormData) {
  const { supabase } = await requireRole(['docente', 'admin'], '/docente');
  const courseId = str(formData, 'course_id');
  const id = str(formData, 'id');
  const dir = str(formData, 'dir') === 'up' ? -1 : 1;
  const { data: lessons } = await supabase.from('lessons').select('id, position').eq('course_id', courseId).order('position').order('created_at');
  if (lessons) {
    const i = lessons.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i >= 0 && j >= 0 && j < lessons.length) {
      [lessons[i], lessons[j]] = [lessons[j], lessons[i]];
      await Promise.all(lessons.map((l, idx) => supabase.from('lessons').update({ position: idx }).eq('id', l.id)));
    }
  }
  revalidatePath(`/docente/cursos/${courseId}`);
  redirect(`/docente/cursos/${courseId}#lecciones`);
}
