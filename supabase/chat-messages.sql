-- Tabela de histórico do chat da Josaninha
-- Cada mensagem é persistida por sessão de dispositivo

create table if not exists public.chat_messages (
  id bigint primary key generated always as identity,
  session_id text not null,
  role text not null check (role in ('assistant', 'user')),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_session_created
  on public.chat_messages(session_id, created_at);

alter table public.chat_messages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'chat_messages' and policyname = 'Public read chat messages') then
    create policy "Public read chat messages"
      on public.chat_messages for select
      using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'chat_messages' and policyname = 'Public insert chat messages') then
    create policy "Public insert chat messages"
      on public.chat_messages for insert
      with check (true);
  end if;
end $$;

alter publication supabase_realtime add table public.chat_messages;
