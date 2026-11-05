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

-- ===== 방명록 (2026-11-05 추가) =====
create table if not exists public.guestbook (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 20),
  message    text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);
alter table public.guestbook enable row level security;

-- ===== 방명록 로그인 연동 (2026-11-05 추가) =====
alter table public.guestbook
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists avatar_url text;
alter table public.guestbook drop constraint if exists guestbook_name_check;
alter table public.guestbook add constraint guestbook_name_check check (char_length(name) between 1 and 40);
-- 인증 설정(대시보드): Site URL = https://bjh-worknote.netlify.app, Redirect URL = https://bjh-worknote.netlify.app/**, GitHub provider 켜기
