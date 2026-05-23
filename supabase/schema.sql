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

-- ── Trades ──────────────────────────────────────────────────────

create table public.trades (
  id               uuid        primary key default gen_random_uuid(),
  from_user_id     uuid        references auth.users(id) on delete cascade not null,
  to_user_id       uuid        references auth.users(id) on delete cascade not null,
  offered_card     jsonb       not null,
  wanted_card_id   text        not null,
  wanted_card_name text        not null,
  status           text        not null default 'pending',
  accepted_card    jsonb,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

alter table public.trades enable row level security;

create policy "Own trades"
  on public.trades for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Create trades"
  on public.trades for insert
  with check (auth.uid() = from_user_id);

create policy "Update trades"
  on public.trades for update
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- View that joins profile names into trade records
create view public.trades_with_profiles as
select
  t.*,
  fp.username as from_username,
  tp.username as to_username
from public.trades t
left join public.profiles fp on fp.user_id = t.from_user_id
left join public.profiles tp on tp.user_id = t.to_user_id;

-- The view inherits RLS from the trades table via security_invoker
alter view public.trades_with_profiles set (security_invoker = true);
