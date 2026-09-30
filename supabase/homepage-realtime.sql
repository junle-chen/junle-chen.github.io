-- Supabase setup for HomePage live memos, paper stars, and note archives.
-- Owner account: junle-chen / 108796659.

create extension if not exists pgcrypto;

create or replace function public.is_homepage_owner()
returns boolean
language sql
stable
as $$
	select
		auth.role() = 'authenticated'
		and (
			coalesce(auth.jwt() -> 'user_metadata' ->> 'provider_id', '') = '108796659'
			or coalesce(auth.jwt() -> 'user_metadata' ->> 'sub', '') = '108796659'
			or coalesce(auth.jwt() -> 'user_metadata' ->> 'user_id', '') = '108796659'
			or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name', '')) = lower('junle-chen')
			or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'preferred_username', '')) = lower('junle-chen')
			or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'nickname', '')) = lower('junle-chen')
			or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'name', '')) = lower('junle-chen')
		);
$$;

create table if not exists public.site_memos (
	id uuid primary key default gen_random_uuid(),
	title text not null default 'Memo',
	content text not null default '',
	category text not null default 'live',
	priority text not null default 'normal',
	source text not null default 'live',
	created_by uuid references auth.users(id) default auth.uid(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz
);

create table if not exists public.site_reactions (
	id uuid primary key default gen_random_uuid(),
	item_type text not null check (item_type in ('daily_paper', 'zotero_paper', 'note_archive')),
	item_key text not null,
	active boolean not null default true,
	created_by uuid references auth.users(id) default auth.uid(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (item_type, item_key)
);

create table if not exists public.site_visit_regions (
	id uuid primary key default gen_random_uuid(),
	country_code text not null default 'ZZ',
	region_label text not null default 'Unknown',
	city_label text not null default '',
	visit_count integer not null default 0 check (visit_count >= 0),
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	unique (country_code, region_label, city_label)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create or replace function public.record_site_visit_region(
	p_country_code text,
	p_region_label text,
	p_city_label text default ''
)
returns table (
	country_code text,
	region_label text,
	city_label text,
	visit_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
	v_country_code text := upper(left(regexp_replace(coalesce(p_country_code, 'ZZ'), '[^A-Za-z]', '', 'g'), 2));
	v_region_label text := left(trim(regexp_replace(coalesce(p_region_label, 'Unknown'), '[<>]', '', 'g')), 80);
	v_city_label text := left(trim(regexp_replace(coalesce(p_city_label, ''), '[<>]', '', 'g')), 80);
begin
	if v_country_code !~ '^[A-Z]{2}$' then
		v_country_code := 'ZZ';
	end if;
	if v_region_label = '' then
		v_region_label := 'Unknown';
	end if;

	update public.site_visit_regions as visits
	set
		visit_count = visits.visit_count + 1,
		last_seen_at = now()
	where visits.country_code = v_country_code
		and visits.region_label = v_region_label
		and visits.city_label = v_city_label
	returning visits.country_code, visits.region_label, visits.city_label, visits.visit_count
	into country_code, region_label, city_label, visit_count;

	if found then
		return next;
		return;
	end if;

	begin
		insert into public.site_visit_regions as visits (
			country_code,
			region_label,
			city_label,
			visit_count,
			first_seen_at,
			last_seen_at
		)
		values (
			v_country_code,
			v_region_label,
			v_city_label,
			1,
			now(),
			now()
		)
		returning visits.country_code, visits.region_label, visits.city_label, visits.visit_count
		into country_code, region_label, city_label, visit_count;
	exception when unique_violation then
		update public.site_visit_regions as visits
		set
			visit_count = visits.visit_count + 1,
			last_seen_at = now()
		where visits.country_code = v_country_code
			and visits.region_label = v_region_label
			and visits.city_label = v_city_label
		returning visits.country_code, visits.region_label, visits.city_label, visits.visit_count
		into country_code, region_label, city_label, visit_count;
	end;

	return next;
end;
$$;

drop trigger if exists set_site_memos_updated_at on public.site_memos;
create trigger set_site_memos_updated_at
	before update on public.site_memos
	for each row execute function public.set_updated_at();

drop trigger if exists set_site_reactions_updated_at on public.site_reactions;
create trigger set_site_reactions_updated_at
	before update on public.site_reactions
	for each row execute function public.set_updated_at();

alter table public.site_memos enable row level security;
alter table public.site_reactions enable row level security;
alter table public.site_visit_regions enable row level security;

drop policy if exists "Public read live memos" on public.site_memos;
create policy "Public read live memos"
	on public.site_memos
	for select
	using (deleted_at is null);

drop policy if exists "Owner insert memos" on public.site_memos;
create policy "Owner insert memos"
	on public.site_memos
	for insert
	with check (public.is_homepage_owner());

drop policy if exists "Owner update memos" on public.site_memos;
create policy "Owner update memos"
	on public.site_memos
	for update
	using (public.is_homepage_owner())
	with check (public.is_homepage_owner());

drop policy if exists "Owner delete memos" on public.site_memos;
create policy "Owner delete memos"
	on public.site_memos
	for delete
	using (public.is_homepage_owner());

drop policy if exists "Public read reactions" on public.site_reactions;
create policy "Public read reactions"
	on public.site_reactions
	for select
	using (true);

drop policy if exists "Owner insert reactions" on public.site_reactions;
create policy "Owner insert reactions"
	on public.site_reactions
	for insert
	with check (public.is_homepage_owner());

drop policy if exists "Owner update reactions" on public.site_reactions;
create policy "Owner update reactions"
	on public.site_reactions
	for update
	using (public.is_homepage_owner())
	with check (public.is_homepage_owner());

drop policy if exists "Owner delete reactions" on public.site_reactions;
create policy "Owner delete reactions"
	on public.site_reactions
	for delete
	using (public.is_homepage_owner());

drop policy if exists "Public read visit regions" on public.site_visit_regions;
create policy "Public read visit regions"
	on public.site_visit_regions
	for select
	using (true);

revoke all on function public.record_site_visit_region(text, text, text) from public;
grant execute on function public.record_site_visit_region(text, text, text) to anon, authenticated;

alter table public.site_memos replica identity full;
alter table public.site_reactions replica identity full;
alter table public.site_visit_regions replica identity full;

do $$
begin
	if exists (
		select 1
		from pg_publication
		where pubname = 'supabase_realtime'
	)
	and not exists (
		select 1
		from pg_publication_tables
		where pubname = 'supabase_realtime'
			and schemaname = 'public'
			and tablename = 'site_memos'
	) then
		alter publication supabase_realtime add table public.site_memos;
	end if;
end;
$$;

do $$
begin
	if exists (
		select 1
		from pg_publication
		where pubname = 'supabase_realtime'
	)
	and not exists (
		select 1
		from pg_publication_tables
		where pubname = 'supabase_realtime'
			and schemaname = 'public'
			and tablename = 'site_reactions'
	) then
		alter publication supabase_realtime add table public.site_reactions;
	end if;
end;
$$;
