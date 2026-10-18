create table if not exists public.fountain_proposals (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null check (lat between 41.45 and 41.85),
  lon double precision not null check (lon between -1.15 and -0.65),
  name text not null default '' check (char_length(name) <= 120),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.fountain_proposals enable row level security;
revoke all on public.fountain_proposals from anon, authenticated;
grant insert (lat, lon, name, note, status) on public.fountain_proposals to anon;

drop policy if exists "Anyone may submit pending fountain proposals" on public.fountain_proposals;
create policy "Anyone may submit pending fountain proposals"
  on public.fountain_proposals for insert to anon
  with check (status = 'pending');

-- No anonymous SELECT/UPDATE/DELETE policies are created. Review is performed
-- in the Supabase dashboard by a trusted project operator.
