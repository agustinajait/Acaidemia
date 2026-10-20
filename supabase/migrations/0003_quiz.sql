-- =====================================================================
-- Evaluación final (quiz) por curso
-- Si un curso tiene preguntas, el certificado exige completar las lecciones
-- Y aprobar el quiz con el porcentaje mínimo del curso.
-- Las respuestas correctas nunca llegan al navegador del alumno:
-- la tabla solo la leen dueño/admin y la corrección se hace en el servidor.
-- =====================================================================

alter table public.courses
  add column quiz_pass_pct int not null default 70 check (quiz_pass_pct between 1 and 100);

create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.courses(id) on delete cascade,
  position       int not null default 0,
  prompt         text not null check (length(trim(prompt)) > 0),
  options        text[] not null check (array_length(options, 1) between 2 and 6),
  correct_index  int not null check (correct_index >= 0),
  created_at     timestamptz not null default now(),
  check (correct_index < array_length(options, 1))
);
create index on public.quiz_questions (course_id, position);

create table public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  correct     int not null,
  total       int not null,
  score_pct   int not null,
  passed      boolean not null,
  created_at  timestamptz not null default now()
);
create index on public.quiz_attempts (user_id, course_id);

alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;

-- Preguntas (con la respuesta correcta): solo dueño del curso o admin
create policy quiz_questions_read on public.quiz_questions for select
  using (public.owns_course(course_id) or public.is_admin());
create policy quiz_questions_write on public.quiz_questions for all
  using (public.owns_course(course_id) or public.is_admin())
  with check (public.owns_course(course_id) or public.is_admin());

-- Intentos: el alumno ve los suyos, el docente los de sus cursos, admin todo.
-- Se escriben solo desde el servidor (service_role) al corregir.
create policy quiz_attempts_read on public.quiz_attempts for select
  using (user_id = auth.uid() or public.owns_course(course_id) or public.is_admin());

-- Preguntas SIN la respuesta correcta, para inscriptos (y vista previa de dueño/admin)
create or replace function public.course_quiz(c uuid)
returns table (id uuid, pos int, prompt text, options text[])
language sql stable security definer set search_path = public as $$
  select q.id, q.position, q.prompt, q.options
  from public.quiz_questions q
  where q.course_id = c
    and (public.is_enrolled(c) or public.owns_course(c) or public.is_admin())
  order by q.position, q.created_at;
$$;

-- Cantidad de preguntas (pública), para mostrar "incluye evaluación final" en el catálogo
create or replace function public.course_quiz_count(c uuid)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.quiz_questions where course_id = c;
$$;

revoke execute on function public.course_quiz(uuid) from public, anon;
grant execute on function public.course_quiz(uuid) to authenticated;
