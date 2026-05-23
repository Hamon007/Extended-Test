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

-- ── Trades (global marketplace listings) ────────────────────────
-- Run this block if upgrading from the old peer-to-peer trade system:
--   drop view if exists public.trades_with_profiles;
--   drop table if exists public.trades cascade;

create table public.trades (
  id                     uuid        primary key default gen_random_uuid(),
  poster_user_id         uuid        references auth.users(id) on delete cascade not null,
  offered_card           jsonb       not null,
  wanted_card_id         text        not null,
  wanted_card_name       text        not null,
  allow_offers           boolean     not null default false,
  status                 text        not null default 'open',
  completed_with_user_id uuid        references auth.users(id) on delete set null,
  accepted_card          jsonb,
  created_at             timestamptz default now() not null,
  updated_at             timestamptz default now() not null
);

alter table public.trades enable row level security;

-- All authenticated users can view all listings
create policy "View trades"
  on public.trades for select
  to authenticated
  using (true);

-- Only the poster can create a listing
create policy "Create listing"
  on public.trades for insert
  with check (auth.uid() = poster_user_id);

-- Poster can cancel; any authenticated user can complete an open listing
create policy "Update trade"
  on public.trades for update
  using (auth.uid() = poster_user_id or status = 'open');

-- ── Trade offers (counter-offers) ───────────────────────────────

create table public.trade_offers (
  id           uuid        primary key default gen_random_uuid(),
  trade_id     uuid        references public.trades(id) on delete cascade not null,
  from_user_id uuid        references auth.users(id) on delete cascade not null,
  offered_card jsonb       not null,
  status       text        not null default 'pending',
  created_at   timestamptz default now() not null
);

alter table public.trade_offers enable row level security;

create policy "View offers"
  on public.trade_offers for select
  to authenticated
  using (true);

create policy "Create offer"
  on public.trade_offers for insert
  with check (auth.uid() = from_user_id);

create policy "Update offer"
  on public.trade_offers for update
  using (
    auth.uid() = from_user_id
    or auth.uid() = (select poster_user_id from public.trades where id = trade_id)
  );

-- ── Views with usernames ─────────────────────────────────────────

create view public.trades_with_profiles as
select
  t.*,
  p.username as poster_username
from public.trades t
left join public.profiles p on p.user_id = t.poster_user_id;

alter view public.trades_with_profiles set (security_invoker = true);

create view public.trade_offers_with_profiles as
select
  o.*,
  p.username as from_username
from public.trade_offers o
left join public.profiles p on p.user_id = o.from_user_id;

alter view public.trade_offers_with_profiles set (security_invoker = true);
