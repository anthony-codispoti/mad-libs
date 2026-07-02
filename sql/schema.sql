-- Mad Libs App — Postgres schema (Neon)
-- Run this once in the Neon SQL Editor (or via the Vercel project's Neon/Storage tab) for your new database.

create extension if not exists pgcrypto;

-- profiles: one row per family member. Open creation, no password.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int,
  age_mode text not null default 'kid' check (age_mode in ('kid', 'teen', 'adult')),
  avatar_emoji text not null default '🙂',
  created_at timestamptz not null default now()
);

-- frameworks: reusable templates (blanks only, no filled words). Shared across all profiles.
create table frameworks (
  id uuid primary key default gen_random_uuid(),
  created_by_profile_id uuid references profiles(id) on delete set null,
  topic text not null,
  title text,
  template text not null,
  blanks jsonb not null,
  age_mode text not null default 'kid',
  created_at timestamptz not null default now()
);
create index frameworks_created_at_idx on frameworks(created_at desc);

-- stories: completed, filled-in stories. Private per-profile.
create table stories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  framework_id uuid references frameworks(id) on delete set null,
  title text,
  template text not null,
  blanks jsonb not null,
  filled_words jsonb not null,
  assembled_text text not null,
  rating int check (rating between 1 and 5),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create index stories_profile_id_idx on stories(profile_id, created_at desc);

-- usage_monthly: one row per calendar month, tracks running AI spend + override flag.
create table usage_monthly (
  id uuid primary key default gen_random_uuid(),
  month text not null unique, -- 'YYYY-MM'
  claude_cost_cents numeric(10,4) not null default 0,
  tts_cost_cents numeric(10,4) not null default 0,
  total_cost_cents numeric(10,4) not null default 0,
  overridden boolean not null default false,
  overridden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profile_stats: lightweight per-profile gamification stats.
create table profile_stats (
  profile_id uuid primary key references profiles(id) on delete cascade,
  stories_completed int not null default 0,
  frameworks_saved int not null default 0,
  current_streak_days int not null default 0,
  longest_streak_days int not null default 0,
  last_completed_date date,
  favorite_word_type text,
  word_type_counts jsonb not null default '{}',
  badges_earned jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- record_ai_cost: atomic check-and-increment for the monthly spend cap.
-- Call with p_claude_cents=0, p_tts_cents=0 as a pre-flight cap check before a
-- paid API call; call again with the real computed cost after the call succeeds.
create or replace function record_ai_cost(
  p_month text,
  p_claude_cents numeric,
  p_tts_cents numeric,
  p_cap_cents numeric
) returns table(total_cost_cents numeric, overridden boolean, was_capped boolean) as $$
declare
  v_row usage_monthly;
begin
  insert into usage_monthly (month) values (p_month) on conflict (month) do nothing;

  select * into v_row from usage_monthly u where u.month = p_month for update;

  if v_row.total_cost_cents >= p_cap_cents and not v_row.overridden then
    return query select v_row.total_cost_cents, v_row.overridden, true;
    return;
  end if;

  update usage_monthly u
    set claude_cost_cents = u.claude_cost_cents + p_claude_cents,
        tts_cost_cents = u.tts_cost_cents + p_tts_cents,
        total_cost_cents = u.total_cost_cents + p_claude_cents + p_tts_cents,
        updated_at = now()
    where u.month = p_month
    returning u.total_cost_cents, u.overridden
    into v_row.total_cost_cents, v_row.overridden;

  return query select v_row.total_cost_cents, v_row.overridden, false;
end;
$$ language plpgsql;
