-- Run after homepage-realtime.sql for a new Supabase project.
-- This migration also replaces the former user_metadata-based owner check.
-- The UUID is the existing junle-chen GitHub sign-in's Supabase Auth user ID.

create or replace function public.is_homepage_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
	select (select auth.uid()) = '9cbda636-f280-4cff-af6c-408e6dd4e59a'::uuid;
$$;

create table if not exists public.site_blog_bookmarks (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null default auth.uid() references auth.users(id),
	url text not null check (length(url) between 1 and 2048 and url ~* '^https?://'),
	title text not null check (length(trim(title)) between 1 and 300),
	summary text not null default '' check (length(summary) <= 2000),
	category text not null default '未分类' check (length(trim(category)) between 1 and 80),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (owner_id, url)
);

alter function public.set_updated_at() set search_path = '';

drop trigger if exists set_site_blog_bookmarks_updated_at on public.site_blog_bookmarks;
create trigger set_site_blog_bookmarks_updated_at
	before update on public.site_blog_bookmarks
	for each row execute function public.set_updated_at();

alter table public.site_blog_bookmarks enable row level security;

-- Grants and RLS are both necessary: anonymous clients get no table access.
revoke all on table public.site_blog_bookmarks from public, anon, authenticated;
grant select, insert, update, delete on table public.site_blog_bookmarks to authenticated;

drop policy if exists "Owner read blog bookmarks" on public.site_blog_bookmarks;
create policy "Owner read blog bookmarks"
	on public.site_blog_bookmarks for select to authenticated
	using (owner_id = (select auth.uid()) and (select public.is_homepage_owner()));

drop policy if exists "Owner add blog bookmarks" on public.site_blog_bookmarks;
create policy "Owner add blog bookmarks"
	on public.site_blog_bookmarks for insert to authenticated
	with check (owner_id = (select auth.uid()) and (select public.is_homepage_owner()));

drop policy if exists "Owner edit blog bookmarks" on public.site_blog_bookmarks;
create policy "Owner edit blog bookmarks"
	on public.site_blog_bookmarks for update to authenticated
	using (owner_id = (select auth.uid()) and (select public.is_homepage_owner()))
	with check (owner_id = (select auth.uid()) and (select public.is_homepage_owner()));

drop policy if exists "Owner remove blog bookmarks" on public.site_blog_bookmarks;
create policy "Owner remove blog bookmarks"
	on public.site_blog_bookmarks for delete to authenticated
	using (owner_id = (select auth.uid()) and (select public.is_homepage_owner()));
