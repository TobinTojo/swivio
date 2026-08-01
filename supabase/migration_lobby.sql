-- Lobby: ready-up, avatars, join lock after start
-- Run in Supabase SQL Editor after schema.sql

alter table room_users add column if not exists is_ready boolean not null default false;
alter table room_users add column if not exists avatar_url text;

-- New rooms start in lobby (existing 'active' rooms keep working as in-progress)
-- alter default only affects new rows if you recreate; createRoom sets status in app

drop policy if exists "room_users_delete_self" on room_users;
create policy "room_users_delete_self" on room_users
  for delete to authenticated
  using (user_id = auth.uid()::text);
