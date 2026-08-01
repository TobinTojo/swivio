-- Add AI recommendation columns to room_movies
alter table room_movies
  add column if not exists ai_recommended boolean default false;

alter table room_movies
  add column if not exists added_at timestamptz not null default now();
