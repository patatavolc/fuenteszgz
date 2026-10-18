create table if not exists public.community_sources (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  name text check (name is null or char_length(btrim(name)) between 1 and 80),
  location text check (location is null or char_length(btrim(location)) between 1 and 160),
  description text check (description is null or char_length(btrim(description)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint community_sources_review_state check (
    (status = 'pending' and reviewed_at is null) or (status <> 'pending' and reviewed_at is not null)
  )
);

create index if not exists community_sources_status_created_idx
  on public.community_sources (status, created_at desc);
create index if not exists community_sources_coordinates_idx
  on public.community_sources (lat, lon);

alter table public.community_sources enable row level security;
revoke all on public.community_sources from anon, authenticated;
grant select on public.community_sources to anon, authenticated;
drop policy if exists "Anyone can read approved community sources" on public.community_sources;
create policy "Anyone can read approved community sources"
  on public.community_sources for select to anon, authenticated
  using (status = 'approved');

comment on table public.community_sources is
  'Community submitted fountain locations. Only approved rows are public; writes and review are performed by server routes after validation and moderator authorization.';
