-- 华采智营重构：门店、事实账本、内容任务、审计
-- 说明：保留旧的 public.facts 表作为兼容数据源；新事实账本使用 fact_ledger。
create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active','disabled')),
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  token_hash text not null unique,
  device_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists store_sessions_store_idx on public.store_sessions(store_id, expires_at);

create table if not exists public.store_profiles (
  store_id uuid primary key references public.stores(id) on delete cascade,
  city text,
  address text,
  phone text,
  business_hours text,
  qr_asset_url text,
  voice_tone text not null default '直接、克制',
  voice_samples jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('qr','photo','logo','other')),
  url text not null,
  source text,
  authorized boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists store_assets_store_idx on public.store_assets(store_id, kind);

create table if not exists public.product_models (
  id text primary key,
  name text not null,
  family text,
  model_key text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.fact_sources (
  id text primary key,
  url text,
  title text,
  publisher text,
  source_type text not null default 'official' check (source_type in ('official','internal','store','third_party')),
  captured_at timestamptz not null,
  body_hash text,
  excerpt text,
  trust_tier smallint not null check (trust_tier between 1 and 6),
  created_at timestamptz not null default now()
);

create table if not exists public.fact_ledger (
  id text primary key,
  product_id text not null,
  model text not null,
  sku text,
  field text not null,
  value jsonb not null,
  unit text,
  conditions text,
  source_id text not null references public.fact_sources(id),
  source_url text,
  source_title text,
  captured_at timestamptz not null,
  published_at timestamptz,
  effective_from timestamptz,
  effective_to timestamptz,
  status text not null default 'active' check (status in ('active','stale','conflict','rejected','superseded','proposed')),
  trust_tier smallint not null check (trust_tier between 1 and 6),
  excerpt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fact_ledger_product_idx on public.fact_ledger(product_id, field, status);
create index if not exists fact_ledger_source_idx on public.fact_ledger(source_id);

create table if not exists public.fact_candidates (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  payload jsonb not null,
  status text not null default 'proposed' check (status in ('proposed','accepted','rejected','conflict')),
  source_id text references public.fact_sources(id),
  created_at timestamptz not null default now()
);

create table if not exists public.fact_conflicts (
  id text primary key,
  product_id text not null,
  field text not null,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  candidates jsonb not null default '[]'::jsonb,
  resolution jsonb,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fact_conflicts_open_idx on public.fact_conflicts(product_id, field, status);

create table if not exists public.content_tasks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  task_card_id text,
  brief text,
  audience text,
  scene text,
  target text,
  real_detail jsonb not null,
  question_answers jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','done','partial','failed','cancelled')),
  progress jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  generation_mode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists content_tasks_store_idx on public.content_tasks(store_id, created_at desc);

create table if not exists public.content_variants (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.content_tasks(id) on delete cascade,
  platform text not null check (platform in ('xiaohongshu','moments','wechat-mp','poster','video')),
  angle text not null check (angle in ('pain','avoidance','story')),
  content jsonb not null,
  status text not null default 'writing' check (status in ('writing','reviewing','blocked','ready','failed')),
  verification jsonb,
  copy_quality jsonb,
  edit_burden text not null default 'light' check (edit_burden in ('none','light','heavy')),
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id, platform, angle)
);
create index if not exists content_variants_task_idx on public.content_variants(task_id, platform, angle);

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.content_tasks(id) on delete cascade,
  variant_id uuid references public.content_variants(id) on delete set null,
  kind text not null default 'image',
  url text,
  status text not null default 'planned' check (status in ('planned','generating','ready','failed')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id bigserial primary key,
  task_id uuid not null references public.content_tasks(id) on delete cascade,
  event jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists task_events_task_idx on public.task_events(task_id, id);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_type text not null default 'system',
  actor_id text,
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 服务端直连；匿名与前端均不允许直接写事实或任务。
alter table public.stores enable row level security;
alter table public.store_sessions enable row level security;
alter table public.store_profiles enable row level security;
alter table public.store_assets enable row level security;
alter table public.product_models enable row level security;
alter table public.fact_sources enable row level security;
alter table public.fact_ledger enable row level security;
alter table public.fact_candidates enable row level security;
alter table public.fact_conflicts enable row level security;
alter table public.content_tasks enable row level security;
alter table public.content_variants enable row level security;
alter table public.content_assets enable row level security;
alter table public.task_events enable row level security;
alter table public.audit_logs enable row level security;
