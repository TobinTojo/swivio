import { createClient } from '@supabase/supabase-js';
import { fetchMoviesByGenres } from './tmdb.js';
import { appendRecommendedMovie as buildNextMovie } from './recommendations.js';
import { ROOM_STATUS, normalizeRoomStatus, canJoinRoom } from './lobby.js';
import { isMissingColumnError } from './dbErrors.js';

export { ROOM_STATUS, normalizeRoomStatus, canJoinRoom };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/** Generate a short uppercase room code */
export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function mapUser(row) {
  return {
    id: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? null,
    isReady: row.is_ready ?? false,
    joinedAt: row.joined_at,
    lastSeen: row.last_seen,
    favoriteGenres: row.favorite_genres ?? [],
  };
}

function mapRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    hostUserId: row.host_user_id,
    status: normalizeRoomStatus(row.status),
  };
}

function mapMovie(row) {
  return {
    id: row.movie_id,
    title: row.title,
    posterUrl: row.poster_url,
    overview: row.overview,
    releaseDate: row.release_date,
    tmdbId: row.tmdb_id,
    genres: row.genres ?? [],
    raw: row.raw,
    aiRecommended: row.ai_recommended ?? false,
    addedAt: row.added_at,
  };
}

function mapVote(row) {
  return {
    id: `${row.user_id}_${row.movie_id}`,
    userId: row.user_id,
    movieId: row.movie_id,
    vote: row.vote,
    createdAt: row.created_at,
  };
}

async function upsertRoomUserRow(row, { minimalExtra = {} } = {}) {
  let { error } = await supabase.from('room_users').upsert(row, { onConflict: 'room_id,user_id' });

  if (error && isMissingColumnError(error)) {
    const minimal = {
      room_id: row.room_id,
      user_id: row.user_id,
      display_name: row.display_name,
      last_seen: row.last_seen ?? new Date().toISOString(),
      ...minimalExtra,
    };
    if (row.favorite_genres) minimal.favorite_genres = row.favorite_genres;
    ({ error } = await supabase.from('room_users').upsert(minimal, { onConflict: 'room_id,user_id' }));
  }

  if (error) throw error;
}

export async function createRoom(roomId, hostUserId) {
  const { error: roomError } = await supabase.from('rooms').insert({
    id: roomId,
    host_user_id: hostUserId,
    status: ROOM_STATUS.LOBBY,
  });
  if (roomError) throw roomError;
}

async function insertRoomMovies(roomId, movies, aiRecommended = false) {
  if (movies.length === 0) return;
  const now = new Date().toISOString();

  const fullRows = movies.map((m) => ({
    room_id: roomId,
    movie_id: m.id,
    title: m.title,
    poster_url: m.posterUrl,
    overview: m.overview,
    release_date: m.releaseDate,
    tmdb_id: m.tmdbId ?? null,
    genres: m.genres ?? [],
    raw: m.raw ?? null,
    ai_recommended: m.aiRecommended ?? aiRecommended,
    added_at: m.addedAt ?? now,
  }));

  let { error } = await supabase.from('room_movies').insert(fullRows);

  // Fallback if optional columns haven't been migrated yet
  if (error) {
    const basicRows = movies.map((m) => ({
      room_id: roomId,
      movie_id: m.id,
      title: m.title,
      poster_url: m.posterUrl,
      overview: m.overview,
      release_date: m.releaseDate,
      tmdb_id: m.tmdbId ?? null,
      genres: m.genres ?? [],
      raw: m.raw ?? null,
    }));
    ({ error } = await supabase.from('room_movies').insert(basicRows));
  }

  if (error) throw error;
}

export async function insertSingleMovie(roomId, movie) {
  await insertRoomMovies(roomId, [movie], movie.aiRecommended ?? false);
}

async function fetchRoomData(roomId) {
  const [users, movies, votes] = await Promise.all([
    fetchUsers(roomId),
    fetchMovies(roomId),
    fetchVotes(roomId),
  ]);
  return { users, movies, votes };
}

/** Groq + TMDB: add one fresh movie after a swipe */
export async function appendRecommendedMovie(roomId, swipedMovieId, vote) {
  return buildNextMovie(supabase, roomId, {
    movieId: swipedMovieId,
    vote,
    fetchRoomData,
    insertMovie: insertSingleMovie,
  });
}

/** Rebuild the swipe deck from everyone's genre picks */
export async function refreshRoomMoviesFromGroup(roomId, fallbackGenres = []) {
  const users = await fetchUsers(roomId);
  let genreNames = [...new Set(users.flatMap((u) => u.favoriteGenres ?? []))];
  if (genreNames.length === 0 && fallbackGenres.length > 0) {
    genreNames = [...fallbackGenres];
  }
  if (genreNames.length === 0) return { movies: [], genreNames: [] };

  const movies = await fetchMoviesByGenres(genreNames);

  const { error: delError } = await supabase
    .from('room_movies')
    .delete()
    .eq('room_id', roomId);
  if (delError) throw delError;

  await insertRoomMovies(roomId, movies);
  return { movies, genreNames };
}

export async function getRoom(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  return mapRoom(data);
}

export async function joinRoomUser(roomId, userId, displayName, avatarUrl = null) {
  const room = await getRoom(roomId);
  if (!room) throw new Error('Room not found');

  const { data: existing } = await supabase
    .from('room_users')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing && !canJoinRoom(room.status)) {
    throw new Error('This session already started. You can\'t join now.');
  }

  const row = {
    room_id: roomId,
    user_id: userId,
    display_name: displayName,
    last_seen: new Date().toISOString(),
    is_ready: false,
  };

  if (avatarUrl) row.avatar_url = avatarUrl;

  await upsertRoomUserRow(row);
}

export async function leaveRoomUser(roomId, userId) {
  const { error } = await supabase
    .from('room_users')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setUserReady(roomId, userId, isReady, displayName, avatarUrl = null) {
  const row = {
    room_id: roomId,
    user_id: userId,
    display_name: displayName,
    is_ready: isReady,
    last_seen: new Date().toISOString(),
  };
  if (avatarUrl) row.avatar_url = avatarUrl;

  try {
    await upsertRoomUserRow(row);
  } catch (err) {
    if (isMissingColumnError(err) && 'is_ready' in row) {
      throw new Error(
        'Ready-up needs a Supabase migration. Run supabase/migration_lobby.sql in the SQL Editor, then refresh.'
      );
    }
    throw err;
  }
}

export async function startRoomFromLobby(roomId, hostUserId) {
  const users = await fetchUsers(roomId);
  if (users.length === 0) throw new Error('No one in the room');
  if (!users.every((u) => u.isReady)) throw new Error('Everyone must ready up first');

  const { error } = await supabase
    .from('rooms')
    .update({ status: ROOM_STATUS.GENRES, last_updated: new Date().toISOString() })
    .eq('id', roomId)
    .eq('host_user_id', hostUserId);

  if (error) throw error;
}

export async function setRoomStatus(roomId, status) {
  const { error } = await supabase
    .from('rooms')
    .update({ status, last_updated: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw error;
}

export async function saveUserGenres(roomId, userId, genres, displayName, avatarUrl = null) {
  const row = {
    room_id: roomId,
    user_id: userId,
    display_name: displayName,
    favorite_genres: genres,
    last_seen: new Date().toISOString(),
  };
  if (avatarUrl) row.avatar_url = avatarUrl;

  await upsertRoomUserRow(row);
}

export async function roomExists(roomId) {
  const room = await getRoom(roomId);
  return Boolean(room);
}

export async function canJoinRoomById(roomId) {
  const room = await getRoom(roomId);
  if (!room) return { ok: false, reason: 'Room not found' };
  if (!canJoinRoom(room.status)) {
    return { ok: false, reason: 'This session already started. You can\'t join now.' };
  }
  return { ok: true, room };
}

export async function castVote(roomId, userId, movieId, vote) {
  const { error } = await supabase.from('room_votes').upsert(
    {
      room_id: roomId,
      user_id: userId,
      movie_id: movieId,
      vote,
    },
    { onConflict: 'room_id,user_id,movie_id' }
  );
  if (error) throw error;
}

async function fetchUsers(roomId) {
  const { data, error } = await supabase
    .from('room_users')
    .select('*')
    .eq('room_id', roomId);
  if (error) throw error;
  return (data ?? []).map(mapUser);
}

async function fetchMovies(roomId) {
  let result = await supabase
    .from('room_movies')
    .select('*')
    .eq('room_id', roomId)
    .order('added_at', { ascending: true });

  // Fallback if added_at column doesn't exist yet
  if (result.error) {
    result = await supabase
      .from('room_movies')
      .select('*')
      .eq('room_id', roomId);
  }

  if (result.error) throw result.error;
  return (result.data ?? []).map(mapMovie);
}

async function fetchVotes(roomId) {
  const { data, error } = await supabase
    .from('room_votes')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapVote);
}

/** Realtime subscription — refetch on any change */
function subscribeTable(roomId, table, fetchFn, callback) {
  fetchFn(roomId).then(callback).catch(console.error);

  const channel = supabase
    .channel(`${table}:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `room_id=eq.${roomId}` },
      () => fetchFn(roomId).then(callback).catch(console.error)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeUsers(roomId, callback) {
  return subscribeTable(roomId, 'room_users', fetchUsers, callback);
}

export function subscribeMovies(roomId, callback) {
  return subscribeTable(roomId, 'room_movies', fetchMovies, callback);
}

export function subscribeVotes(roomId, callback) {
  return subscribeTable(roomId, 'room_votes', fetchVotes, callback);
}

export function subscribeRoom(roomId, callback, onError) {
  supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        onError?.(error);
        return;
      }
      callback(mapRoom(data));
    });

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      async () => {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .maybeSingle();
        if (error) {
          onError?.(error);
          return;
        }
        callback(mapRoom(data));
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/** AI cache helpers */
export async function getAiCache(roomId, docId) {
  const { data, error } = await supabase
    .from('room_ai_cache')
    .select('*')
    .eq('room_id', roomId)
    .eq('doc_id', docId)
    .maybeSingle();
  if (error || !data) return null;

  const created = new Date(data.created_at).getTime();
  if (data.ttl_ms && created + data.ttl_ms < Date.now()) return null;

  return { id: data.doc_id, type: data.type, payload: data.payload, createdAt: data.created_at };
}

export async function setAiCache(roomId, docId, type, payload, ttlMs = 3600000) {
  const { error } = await supabase.from('room_ai_cache').upsert(
    {
      room_id: roomId,
      doc_id: docId,
      type,
      payload,
      ttl_ms: ttlMs,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'room_id,doc_id' }
  );
  if (error) throw error;
}

export function subscribeAiCache(roomId, docId, callback) {
  getAiCache(roomId, docId).then(callback).catch(console.error);

  const channel = supabase
    .channel(`ai:${roomId}:${docId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_ai_cache',
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        const cached = await getAiCache(roomId, docId);
        callback(cached);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
