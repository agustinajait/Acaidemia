-- =====================================================================
-- Portadas de cursos: imagen o video subidos por el docente
-- Bucket público (las portadas se ven en el catálogo sin iniciar sesión).
-- Cada docente sube solo dentro de su carpeta: portadas/<user_id>/...
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portadas', 'portadas', true, 52428800, -- 50 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

create policy portadas_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'portadas' and (storage.foldername(name))[1] = auth.uid()::text and public.is_teacher());

create policy portadas_update on storage.objects for update to authenticated
  using (bucket_id = 'portadas' and (storage.foldername(name))[1] = auth.uid()::text);

create policy portadas_delete on storage.objects for delete to authenticated
  using (bucket_id = 'portadas' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
