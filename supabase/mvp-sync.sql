create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "MVP app state read" on public.app_state;
drop policy if exists "MVP app state insert" on public.app_state;
drop policy if exists "MVP app state update" on public.app_state;

create policy "MVP app state read"
  on public.app_state for select
  using (true);

create policy "MVP app state insert"
  on public.app_state for insert
  with check (id in ('store', 'customers'));

create policy "MVP app state update"
  on public.app_state for update
  using (id in ('store', 'customers'))
  with check (id in ('store', 'customers'));

do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
