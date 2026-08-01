# Swivio

Movie swiping with real-time group sync — like Spotify Jam, but for movie night.

Swipe through movies with friends, see live matches ranked by group score, track compatibility, and get AI-powered taste summaries.

## Quick Start

```bash
npm install
cp .env.example .env   # fill in Supabase + TMDB + Groq keys
npm run dev
```

Open `http://localhost:5173`, sign in with Google, and create a room.

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | **Yes** | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase anon/public key |
| `VITE_TMDB_KEY` | Recommended | TMDB API key for live movie data |
| `VITE_GROQ_API_KEY` | Optional | Free AI via Groq |

Without TMDB, the app uses built-in mock movies. Without Groq, AI panels are hidden.

## Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `supabase/schema.sql`
3. If you already ran the old open RLS policies, also run `supabase/migration_auth_rls.sql`
4. Enable **Realtime** for these tables (Dashboard → Database → Publications):
   - `rooms`, `room_users`, `room_movies`, `room_votes`, `room_ai_cache`
5. Copy credentials from **Project Settings → API**:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`

### Env template

```env
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_TMDB_KEY=your_tmdb_key
VITE_GROQ_API_KEY=gsk_...
```

## Google Sign-In (required)

Only signed-in users can create or join rooms. Auth is handled by **Supabase Auth** — no extra npm packages.

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or pick an existing one)
3. **APIs & Services → OAuth consent screen** → configure (External, add your email as test user if in Testing mode)
4. **Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:5173`
     - `https://YOUR-NETLIFY-OR-RENDER-URL.com`
   - Authorized redirect URIs:
     - `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**

### 2. Supabase Dashboard

1. **Authentication → Providers → Google** → Enable
2. Paste Client ID and Client Secret
3. **Authentication → URL Configuration**:
   - **Site URL**: your production URL (e.g. `https://swivio.netlify.app`)
   - **Redirect URLs** (add all that apply):
     - `http://localhost:5173`
     - `https://YOUR-NETLIFY-OR-RENDER-URL.com`

### 3. Run the auth RLS migration

If your database still has the old open `mvp_all_*` policies:

```sql
-- Run supabase/migration_auth_rls.sql in the SQL Editor
```

Fresh installs: `schema.sql` already includes authenticated-only policies.

## Deploy

Swivio is a **static Vite SPA**. Supabase is your backend — you only need to host the frontend build (`dist/`).

Set these **environment variables** on your host (same names as `.env`):

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Your anon key |
| `VITE_TMDB_KEY` | TMDB key |
| `VITE_GROQ_API_KEY` | Groq key (optional) |

After deploying, add your live URL to **Supabase Auth → URL Configuration** and **Google OAuth redirect URIs**.

### Option A: Netlify (recommended)

1. Push the repo to GitHub
2. [Netlify](https://netlify.com) → **Add new site → Import from Git**
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Site settings → Environment variables** → add the four `VITE_*` vars
5. Deploy

`netlify.toml` includes SPA redirects so `/room/ABC123` works on refresh.

**CLI alternative:**

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Option B: Render

1. Push the repo to GitHub
2. [Render](https://render.com) → **New → Static Site** → connect repo
3. Settings (or use `render.yaml` blueprint):
   - Build: `npm install && npm run build`
   - Publish directory: `dist`
4. Add environment variables under **Environment**
5. Render rewrites `/*` → `/index.html` for client-side routing

You do **not** need a Render web service or Docker container — a static site is enough.

## TMDB API Key (free)

1. Create account at [themoviedb.org](https://www.themoviedb.org/signup)
2. Go to **Settings → API** → Request an API key (Developer, personal use)
3. Copy the **API Key (v3 auth)** into `VITE_TMDB_KEY`

## Groq AI (free, no credit card)

1. Sign up at [console.groq.com](https://console.groq.com)
2. Go to **API Keys** → Create key
3. Add to `.env` as `VITE_GROQ_API_KEY`

Uses `llama-3.3-70b-versatile`. AI features unlock after **10+ group votes**.

## How It Works

### Routes

- `/` — Landing: Google sign-in, create or join a room
- `/room/:id` — Swipe deck, matches, compatibility, people (protected)

### User identity

Google sign-in via Supabase Auth. Your Google account UUID is used as `user_id` in the database. Display name comes from your Google profile (editable when joining a room).

### Real-time sync

Supabase Realtime `postgres_changes` listeners on room tables. Updates appear across devices in ~1s.

### Scoring (`src/lib/scoring.js`)

- **Group match score**: weighted votes (watched = ±2, like/dislike = ±1)
- **User compatibility**: agreement rate on movies both users voted on

## Database Schema

```
rooms              id, host_user_id, status, created_at
room_users         room_id + user_id, display_name, favorite_genres
room_movies        room_id + movie_id, title, poster_url, overview, genres
room_votes         room_id + user_id + movie_id, vote (1|-1|2|-2)
room_ai_cache      room_id + doc_id, type, payload, ttl_ms
```

See `supabase/schema.sql` for the full migration with auth RLS policies.

## Project Structure

```
src/
  context/      AuthContext.jsx
  lib/          supabase.js, auth.js, tmdb.js, ai.js, scoring.js
  components/   SwipeDeck, MovieCard, GoogleSignInButton, ProtectedRoute, etc.
  pages/        Landing, Room
  styles/       base.css, components.css, landing.css
supabase/
  schema.sql              Database migration (fresh installs)
  migration_auth_rls.sql  Upgrade from open MVP policies
netlify.toml              Netlify deploy config
render.yaml               Render static site blueprint
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Demo Checklist

- [ ] Run `supabase/schema.sql` (or `migration_auth_rls.sql` if upgrading)
- [ ] Enable Google provider in Supabase + Google Cloud OAuth
- [ ] Enable Realtime on all 5 tables
- [ ] Add env vars locally and on Netlify/Render
- [ ] Add production URL to Supabase Auth + Google OAuth
- [ ] Sign in with Google, create room in browser A, join in browser B
- [ ] Swipe movies — votes sync live

## License

MIT
