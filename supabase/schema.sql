-- Swivio Supabase schema
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

create table if not exists rooms (
  id text primary key,
  host_user_id text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now()
);

create table if not exists room_users (
  room_id text not null references rooms(id) on delete cascade,
  user_id text not null,
  display_name text not null,
  favorite_genres jsonb default '[]'::jsonb,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists room_movies (
  room_id text not null references rooms(id) on delete cascade,
  movie_id text not null,
  title text not null,
  poster_url text,
  overview text,
  release_date text,
  tmdb_id integer,
  genres jsonb default '[]'::jsonb,
  raw jsonb,
  ai_recommended boolean default false,
  added_at timestamptz not null default now(),
  primary key (room_id, movie_id)
);

create table if not exists room_votes (
  room_id text not null references rooms(id) on delete cascade,
  user_id text not null,
  movie_id text not null,
  vote smallint not null check (vote in (1, -1, 2, -2)),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id, movie_id)
);

create table if not exists room_ai_cache (
  room_id text not null references rooms(id) on delete cascade,
  doc_id text not null,
  type text not null,
  payload text not null,
  created_at timestamptz not null default now(),
  ttl_ms bigint default 3600000,
  primary key (room_id, doc_id)
);

-- Realtime: add tables to the supabase_realtime publication
alter table rooms replica identity full;
alter table room_users replica identity full;
alter table room_movies replica identity full;
alter table room_votes replica identity full;
alter table room_ai_cache replica identity full;

alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_users;
alter publication supabase_realtime add table room_movies;
alter publication supabase_realtime add table room_votes;
alter publication supabase_realtime add table room_ai_cache;

-- RLS — authenticated users only (Google sign-in via Supabase Auth)
alter table rooms enable row level security;
alter table room_users enable row level security;
alter table room_movies enable row level security;
alter table room_votes enable row level security;
alter table room_ai_cache enable row level security;

create policy "rooms_select_auth" on rooms for select to authenticated using (true);
create policy "rooms_insert_auth" on rooms for insert to authenticated with check (host_user_id = auth.uid()::text);
create policy "rooms_update_auth" on rooms for update to authenticated using (host_user_id = auth.uid()::text);

create policy "room_users_select_auth" on room_users for select to authenticated using (true);
create policy "room_users_insert_auth" on room_users for insert to authenticated with check (user_id = auth.uid()::text);
create policy "room_users_update_auth" on room_users for update to authenticated using (user_id = auth.uid()::text);

create policy "room_movies_select_auth" on room_movies for select to authenticated using (true);
create policy "room_movies_insert_auth" on room_movies for insert to authenticated with check (true);
create policy "room_movies_update_auth" on room_movies for update to authenticated using (true);
create policy "room_movies_delete_auth" on room_movies for delete to authenticated using (true);

create policy "room_votes_select_auth" on room_votes for select to authenticated using (true);
create policy "room_votes_insert_auth" on room_votes for insert to authenticated with check (user_id = auth.uid()::text);
create policy "room_votes_update_auth" on room_votes for update to authenticated using (user_id = auth.uid()::text);

create policy "room_ai_cache_select_auth" on room_ai_cache for select to authenticated using (true);
create policy "room_ai_cache_insert_auth" on room_ai_cache for insert to authenticated with check (true);
create policy "room_ai_cache_update_auth" on room_ai_cache for update to authenticated using (true);
