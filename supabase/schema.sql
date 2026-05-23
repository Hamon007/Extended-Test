-- Codex Immortalis – Supabase Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query

create table public.saves (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null unique,
  data       jsonb       not null,
  updated_at timestamptz default now() not null
);

-- Row Level Security: each user can only read/write their own row
alter table public.saves enable row level security;

create policy "Own save only"
  on public.saves for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
