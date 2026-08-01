-- Daily swipes, group chat, and daily AI picks
-- Run in Supabase SQL Editor

-- Personal taste profile (genres for solo daily swipes)
create table if not exists user_profiles (
  user_id text primary key,
  display_name text,
  avatar_url text,
  favorite_genres jsonb default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Solo daily swipes — builds preference data over time
create table if not exists user_swipes (
  user_id text not null,
  movie_id text not null,
  title text not null,
  poster_url text,
  genres jsonb default '[]'::jsonb,
  vote smallint not null check (vote in (1, -1, 2, -2)),
  swipe_date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id, swipe_date)
);

create index if not exists user_swipes_user_date on user_swipes (user_id, swipe_date desc);

-- Group chat
create table if not exists room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(id) on delete cascade,
  user_id text not null,
  display_name text not null,
  avatar_url text,
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists room_messages_room_created on room_messages (room_id, created_at);

-- One AI pick per room per calendar day
create table if not exists room_daily_picks (
  room_id text not null references rooms(id) on delete cascade,
  pick_date date not null default current_date,
  movie_id text not null,
  title text not null,
  poster_url text,
  overview text,
  tmdb_id integer,
  genres jsonb default '[]'::jsonb,
  ai_reason text,
  generated_at timestamptz not null default now(),
  primary key (room_id, pick_date)
);

-- Everyone in the room must vote on the daily pick
create table if not exists room_daily_votes (
  room_id text not null,
  pick_date date not null,
  user_id text not null,
  vote smallint not null check (vote in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (room_id, pick_date, user_id),
  foreign key (room_id, pick_date) references room_daily_picks(room_id, pick_date) on delete cascade
);

-- Realtime
alter table user_profiles replica identity full;
alter table user_swipes replica identity full;
alter table room_messages replica identity full;
alter table room_daily_picks replica identity full;
alter table room_daily_votes replica identity full;

alter publication supabase_realtime add table user_profiles;
alter publication supabase_realtime add table user_swipes;
alter publication supabase_realtime add table room_messages;
alter publication supabase_realtime add table room_daily_picks;
alter publication supabase_realtime add table room_daily_votes;

-- RLS
alter table user_profiles enable row level security;
alter table user_swipes enable row level security;
alter table room_messages enable row level security;
alter table room_daily_picks enable row level security;
alter table room_daily_votes enable row level security;

create policy "profiles_select_auth" on user_profiles for select to authenticated using (true);
create policy "profiles_upsert_self" on user_profiles for insert to authenticated with check (user_id = auth.uid()::text);
create policy "profiles_update_self" on user_profiles for update to authenticated using (user_id = auth.uid()::text);

create policy "user_swipes_select_auth" on user_swipes for select to authenticated using (true);
create policy "user_swipes_insert_self" on user_swipes for insert to authenticated with check (user_id = auth.uid()::text);

create policy "messages_select_auth" on room_messages for select to authenticated using (true);
create policy "messages_insert_auth" on room_messages for insert to authenticated with check (user_id = auth.uid()::text);

create policy "daily_picks_select_auth" on room_daily_picks for select to authenticated using (true);
create policy "daily_picks_insert_auth" on room_daily_picks for insert to authenticated with check (true);

create policy "daily_votes_select_auth" on room_daily_votes for select to authenticated using (true);
create policy "daily_votes_insert_self" on room_daily_votes for insert to authenticated with check (user_id = auth.uid()::text);
create policy "daily_votes_update_self" on room_daily_votes for update to authenticated using (user_id = auth.uid()::text);
