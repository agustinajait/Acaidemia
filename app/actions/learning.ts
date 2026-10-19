'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { issueCertificateIfComplete } from '@/lib/enrollment';

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
  }
  const next = String(formData.get('next') || lessonId);
  revalidatePath(`/aprender/${slug}`);
  redirect(`/aprender/${slug}?l=${done ? lessonId : next}`);
}
