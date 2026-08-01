-- Swivio: Google Auth RLS migration
-- Run AFTER schema.sql if you already have the open MVP policies.
-- Requires Supabase Auth with Google provider enabled.

-- Remove open MVP policies
drop policy if exists "mvp_all_rooms" on rooms;
drop policy if exists "mvp_all_room_users" on room_users;
drop policy if exists "mvp_all_room_movies" on room_movies;
drop policy if exists "mvp_all_room_votes" on room_votes;
drop policy if exists "mvp_all_room_ai_cache" on room_ai_cache;

-- Rooms
create policy "rooms_select_auth" on rooms
  for select to authenticated using (true);

create policy "rooms_insert_auth" on rooms
  for insert to authenticated
  with check (host_user_id = auth.uid()::text);

create policy "rooms_update_auth" on rooms
  for update to authenticated
  using (host_user_id = auth.uid()::text);

-- Room members
create policy "room_users_select_auth" on room_users
  for select to authenticated using (true);

create policy "room_users_insert_auth" on room_users
  for insert to authenticated
  with check (user_id = auth.uid()::text);

create policy "room_users_update_auth" on room_users
  for update to authenticated
  using (user_id = auth.uid()::text);

-- Movies in deck
create policy "room_movies_select_auth" on room_movies
  for select to authenticated using (true);

create policy "room_movies_insert_auth" on room_movies
  for insert to authenticated with check (true);

create policy "room_movies_update_auth" on room_movies
  for update to authenticated using (true);

create policy "room_movies_delete_auth" on room_movies
  for delete to authenticated using (true);

-- Votes
create policy "room_votes_select_auth" on room_votes
  for select to authenticated using (true);

create policy "room_votes_insert_auth" on room_votes
  for insert to authenticated
  with check (user_id = auth.uid()::text);

create policy "room_votes_update_auth" on room_votes
  for update to authenticated
  using (user_id = auth.uid()::text);

-- AI cache
create policy "room_ai_cache_select_auth" on room_ai_cache
  for select to authenticated using (true);

create policy "room_ai_cache_insert_auth" on room_ai_cache
  for insert to authenticated with check (true);

create policy "room_ai_cache_update_auth" on room_ai_cache
  for update to authenticated using (true);
