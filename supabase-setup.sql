-- Trace Solutions Global: reviews, website orders and the projects dashboard.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.

create extension if not exists pgcrypto;

-- Admins: only these email addresses can edit reviews and see projects.
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Reviews: anyone can post, they show on the site straight away,
-- and admins can edit, hide or delete them.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  business text not null default '' check (char_length(business) <= 120),
  country text not null default '' check (char_length(country) <= 60),
  rating int not null default 5 check (rating between 1 and 5),
  text text not null check (char_length(text) between 10 and 1200),
  hidden boolean not null default false
);
alter table public.reviews enable row level security;

drop policy if exists "reviews read" on public.reviews;
drop policy if exists "reviews post" on public.reviews;
drop policy if exists "reviews edit" on public.reviews;
drop policy if exists "reviews delete" on public.reviews;
create policy "reviews read" on public.reviews for select using (not hidden or public.is_admin());
create policy "reviews post" on public.reviews for insert with check (not hidden or public.is_admin());
create policy "reviews edit" on public.reviews for update using (public.is_admin()) with check (public.is_admin());
create policy "reviews delete" on public.reviews for delete using (public.is_admin());

-- Projects: the dashboard. Website orders arrive as new leads.
create sequence if not exists public.project_code_seq;
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  source text not null default 'admin',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.projects_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'TS-' || lpad(nextval('public.project_code_seq')::text, 3, '0');
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists projects_before_write on public.projects;
create trigger projects_before_write before insert or update on public.projects
  for each row execute function public.projects_before_write();

alter table public.projects enable row level security;

drop policy if exists "projects order" on public.projects;
drop policy if exists "projects read" on public.projects;
drop policy if exists "projects edit" on public.projects;
drop policy if exists "projects delete" on public.projects;
create policy "projects order" on public.projects for insert with check (
  public.is_admin()
  or (source = 'website' and code is null and data ->> 'stage' = 'lead' and octet_length(data::text) < 100000)
);
create policy "projects read" on public.projects for select using (public.is_admin());
create policy "projects edit" on public.projects for update using (public.is_admin()) with check (public.is_admin());
create policy "projects delete" on public.projects for delete using (public.is_admin());

-- Your admin login(s). Add one line per person who should have access.
insert into public.admins (email) values ('sales@tracesolutionsglobal.com') on conflict do nothing;
