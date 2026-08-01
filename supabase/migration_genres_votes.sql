-- Run this in Supabase SQL Editor if you already created the database
-- Adds genre preferences + watched vote types

alter table room_users
  add column if not exists favorite_genres jsonb default '[]'::jsonb;

alter table room_votes drop constraint if exists room_votes_vote_check;
alter table room_votes
  add constraint room_votes_vote_check check (vote in (1, -1, 2, -2));
