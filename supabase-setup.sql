-- CLS Operations Hub: run this once in Supabase -> SQL Editor -> New query -> Run.
-- One table holds every record. "collection" is the section name (staff, fuel, alarms, ...).

create table if not exists public.records (
  collection text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid        default auth.uid(),
  primary key (collection, id)
);

create index if not exists records_collection_idx on public.records (collection);

-- Stamp who changed a row and when.
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- Row Level Security: only signed-in team members can read or write.
alter table public.records enable row level security;

drop policy if exists "team read"   on public.records;
drop policy if exists "team insert" on public.records;
drop policy if exists "team update" on public.records;
drop policy if exists "team delete" on public.records;

create policy "team read"   on public.records for select to authenticated using (true);
create policy "team insert" on public.records for insert to authenticated with check (true);
create policy "team update" on public.records for update to authenticated using (true) with check (true);
create policy "team delete" on public.records for delete to authenticated using (true);

-- Live updates between users.
do $$
begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null;
end $$;
