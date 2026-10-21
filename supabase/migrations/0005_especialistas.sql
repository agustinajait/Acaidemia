-- =====================================================================
-- Directorio público de especialistas (lo administra el admin)
-- No requiere que la persona tenga cuenta en la plataforma.
-- =====================================================================

create table public.specialists (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null check (length(trim(full_name)) > 0),
  category      text not null default '',
  bio           text not null default '',
  photo_url     text,
  linkedin_url  text,
  position      int not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.specialists (published, position);

alter table public.specialists enable row level security;

-- Lectura: cualquiera ve los publicados; el admin ve todos
create policy specialists_read on public.specialists for select
  using (published or public.is_admin());

-- Escritura: solo admin
create policy specialists_write on public.specialists for all
  using (public.is_admin())
  with check (public.is_admin());
