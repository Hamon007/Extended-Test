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

-- ── Profiles ────────────────────────────────────────────────────

create table public.profiles (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references auth.users(id) on delete cascade not null unique,
  username            text        not null default 'Spieler',
  friend_code         text        not null unique,
  username_changed_at timestamptz,
  created_at          timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- All logged-in users can read profiles (needed for trading)
create policy "Profiles public for authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can insert and update their own profile
create policy "Own profile insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Own profile update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
