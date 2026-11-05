-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
create table if not exists public.cheers (
  work_id text primary key,
  count   integer not null default 0
);

insert into public.cheers (work_id, count) values
  ('snake', 0), ('profile', 0), ('next', 0)
on conflict (work_id) do nothing;

-- 공개 접근 차단: 정책이 없으므로 anon 키로는 읽기/쓰기 불가.
-- Netlify Function(service role 키)만 접근합니다.
alter table public.cheers enable row level security;

create or replace function public.increment_cheer(p_work_id text)
returns integer
language sql
as $$
  update public.cheers set count = count + 1
  where work_id = p_work_id
  returning count;
$$;

revoke all on function public.increment_cheer(text) from public, anon, authenticated;
