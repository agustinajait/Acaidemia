-- =====================================================================
-- Acaidemia (HUEHACI) — esquema inicial
-- Roles: alumno, docente, admin
-- Pagos: Mercado Pago (automático vía webhook) y transferencia (aprobación admin)
-- Certificados: código único verificable + estrellas en el perfil
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type public.user_role      as enum ('alumno', 'docente', 'admin');
create type public.course_status  as enum ('borrador', 'en_revision', 'publicado', 'archivado');
create type public.payment_method as enum ('mercadopago', 'transferencia', 'gratis');
create type public.payment_status as enum ('pendiente', 'en_revision', 'aprobado', 'rechazado');

-- ---------- Perfiles ----------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null default '',
  bio              text,
  avatar_url       text,
  role             public.user_role not null default 'alumno',
  teacher_request  boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---------- Configuración (fila única) ----------
create table public.settings (
  id                  int primary key default 1 check (id = 1),
  commission_pct      numeric(5,2) not null default 20,      -- comisión de la plataforma sobre cursos de docentes
  bank_holder         text not null default 'HUEHACI',
  bank_cuit           text not null default '',
  bank_cbu            text not null default '',
  bank_alias          text not null default '',
  bank_name           text not null default '',
  transfer_notes      text not null default 'Enviá el comprobante desde la plataforma. Lo revisamos en menos de 48 h hábiles.',
  updated_at          timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------- Cursos ----------
create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete restrict,
  slug          text not null unique,
  title         text not null,
  subtitle      text,
  description   text not null default '',
  category      text,
  cover_url     text,
  hours         numeric(5,1),
  price_ars     numeric(12,2) not null default 0 check (price_ars >= 0),
  status        public.course_status not null default 'borrador',
  review_notes  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.courses (status);
create index on public.courses (owner_id);

create table public.lessons (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  position    int not null default 0,
  title       text not null,
  video_url   text,
  content     text not null default '',
  created_at  timestamptz not null default now()
);
create index on public.lessons (course_id, position);

-- ---------- Pagos / inscripciones ----------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  course_id        uuid not null references public.courses(id) on delete restrict,
  method           public.payment_method not null,
  status           public.payment_status not null default 'pendiente',
  amount_ars       numeric(12,2) not null,
  platform_fee_ars numeric(12,2) not null default 0,
  teacher_amount_ars numeric(12,2) not null default 0,
  mp_preference_id text,
  mp_payment_id    text unique,
  receipt_path     text,               -- storage: comprobantes/<user_id>/<archivo>
  admin_notes      text,
  reviewed_by      uuid references public.profiles(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index on public.payments (status);
create index on public.payments (user_id);
create index on public.payments (course_id);

create table public.enrollments (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  payment_id  uuid references public.payments(id),
  created_at  timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table public.lesson_progress (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ---------- Certificados ----------
create table public.certificates (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete restrict,
  holder_name text not null,          -- nombre tal como figura al emitirse
  course_title text not null,
  hours       numeric(5,1),
  issued_at   timestamptz not null default now(),
  unique (user_id, course_id)
);

-- =====================================================================
-- Funciones auxiliares
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('docente','admin'));
$$;

create or replace function public.owns_course(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = c and owner_id = auth.uid());
$$;

create or replace function public.is_enrolled(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where course_id = c and user_id = auth.uid());
$$;

-- Temario público (solo títulos) de un curso publicado
create or replace function public.course_syllabus(c uuid)
returns table (id uuid, pos int, title text)
language sql stable security definer set search_path = public as $$
  select l.id, l.position, l.title
  from public.lessons l
  join public.courses co on co.id = l.course_id
  where l.course_id = c
    and (co.status = 'publicado' or co.owner_id = auth.uid() or public.is_admin())
  order by l.position, l.created_at;
$$;

-- Perfil automático al registrarse
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nadie cambia su propio rol (solo admin o service_role)
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.jwt()->>'role','') <> 'service_role'
     and not public.is_admin() then
    raise exception 'No podés cambiar tu rol';
  end if;
  return new;
end $$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Solo admin publica cursos; el docente puede pasarlos a borrador / en_revision / archivado
create or replace function public.protect_course_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  privileged boolean := coalesce(auth.jwt()->>'role','') = 'service_role' or public.is_admin();
  was_published boolean := false;
begin
  if tg_op = 'UPDATE' then
    was_published := old.status = 'publicado';
    if new.owner_id is distinct from old.owner_id and not privileged then
      raise exception 'No se puede cambiar el dueño del curso';
    end if;
  end if;
  if new.status = 'publicado' and not was_published and not privileged then
    raise exception 'Solo la administración puede publicar cursos';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger courses_protect_status
  before insert or update on public.courses
  for each row execute function public.protect_course_status();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.settings        enable row level security;
alter table public.courses         enable row level security;
alter table public.lessons         enable row level security;
alter table public.payments        enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.certificates    enable row level security;

-- Perfiles: públicos para lectura (perfil con estrellas), cada uno edita el suyo
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Configuración: lectura pública (datos de transferencia), edición admin
create policy settings_read   on public.settings for select using (true);
create policy settings_update on public.settings for update using (public.is_admin());

-- Cursos
create policy courses_read on public.courses for select
  using (status = 'publicado' or owner_id = auth.uid() or public.is_admin());
create policy courses_insert on public.courses for insert
  with check (owner_id = auth.uid() and public.is_teacher());
create policy courses_update on public.courses for update
  using (owner_id = auth.uid() or public.is_admin());
create policy courses_delete on public.courses for delete
  using ((owner_id = auth.uid() and status = 'borrador') or public.is_admin());

-- Lecciones: contenido solo para inscriptos, dueño o admin
create policy lessons_read on public.lessons for select
  using (public.is_enrolled(course_id) or public.owns_course(course_id) or public.is_admin());
create policy lessons_write on public.lessons for all
  using (public.owns_course(course_id) or public.is_admin())
  with check (public.owns_course(course_id) or public.is_admin());

-- Pagos: el alumno ve los suyos, el docente las ventas de sus cursos, admin todo.
-- Escrituras solo desde el servidor (service_role).
create policy payments_read on public.payments for select
  using (user_id = auth.uid() or public.owns_course(course_id) or public.is_admin());

-- Inscripciones: lectura; altas solo desde el servidor
create policy enrollments_read on public.enrollments for select
  using (user_id = auth.uid() or public.owns_course(course_id) or public.is_admin());

-- Progreso: cada alumno el suyo, solo en cursos donde está inscripto
create policy progress_read on public.lesson_progress for select
  using (user_id = auth.uid() or public.is_admin());
create policy progress_insert on public.lesson_progress for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.lessons l where l.id = lesson_id and public.is_enrolled(l.course_id))
  );
create policy progress_delete on public.lesson_progress for delete using (user_id = auth.uid());

-- Certificados: lectura pública (verificación por QR); emisión solo servidor
create policy certificates_read on public.certificates for select using (true);

-- =====================================================================
-- Storage: comprobantes de transferencia (privado)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy comprobantes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy comprobantes_read on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
