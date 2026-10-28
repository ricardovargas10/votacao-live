-- Cria a tabela que guarda a cópia do placar para o site público.
-- Cole tudo no Supabase em SQL Editor > New query e clique em Run.
create table if not exists public.estado (
  id text primary key,            -- "placar" ou "biblioteca"
  dados jsonb not null,
  atualizado timestamptz not null default now()
);

-- qualquer pessoa pode LER; só o PC do Ric (chave secreta) pode gravar
alter table public.estado enable row level security;
drop policy if exists "leitura publica" on public.estado;
create policy "leitura publica" on public.estado for select to anon, authenticated using (true);
grant select on public.estado to anon, authenticated;

-- avisa o site na hora em que o placar muda
do $$ begin
  alter publication supabase_realtime add table public.estado;
exception when duplicate_object then null; end $$;
