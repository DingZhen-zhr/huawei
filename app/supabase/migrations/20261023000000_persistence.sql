alter table public.stores add column if not exists demo boolean not null default false;

-- 持久化补丁：内容任务完整快照 + 运行时状态（事实候选/冲突确认）
-- 说明：content_tasks 的结构化列保留用于查询；payload 存完整任务快照，避免字段漂移。

alter table public.content_tasks
  add column if not exists payload jsonb not null default '{}'::jsonb;

create index if not exists content_tasks_status_idx on public.content_tasks(status, updated_at desc);

create table if not exists public.runtime_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.runtime_state enable row level security;

drop trigger if exists runtime_state_touch on public.runtime_state;
create trigger runtime_state_touch before update on public.runtime_state
for each row execute function public.touch_updated_at();
