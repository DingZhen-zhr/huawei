-- 华采智营：会话记忆 + 知识库事实
create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  slots jsonb not null default '{}'::jsonb,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id bigserial primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  facts jsonb not null default '[]'::jsonb,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_session_idx on public.messages(session_id, created_at);

create table if not exists public.facts (
  id bigserial primary key,
  kind text not null,
  model text not null,
  text text not null,
  price integer,
  source text not null,
  snapshot_date date,
  created_at timestamptz not null default now()
);
create index if not exists facts_model_idx on public.facts(model);
create index if not exists facts_kind_idx on public.facts(kind);

-- 只允许服务端（直连）访问；PostgREST 匿名访问一律拒绝
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.facts enable row level security;

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sessions_touch on public.sessions;
create trigger sessions_touch before update on public.sessions
for each row execute function public.touch_updated_at();
