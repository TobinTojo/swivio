import { supabase } from './supabase.js';
import { todayDateString, DAILY_SWIPE_LIMIT } from './dailyUtils.js';
import { fetchMoviesByGenres } from './tmdb.js';
import { mockMovies } from '../data/mockMovies.js';
import { isPositiveVote } from './votes.js';
import {
  getLocalDailyGenres,
  setLocalDailyGenres,
  getLocalTodaySwipes,
  addLocalSwipe,
} from './dailyStorage.js';
import { isMissingTableError } from './dbErrors.js';

function subscribeTable(table, filterKey, filterVal, fetchFn, callback) {
  fetchFn(filterVal).then(callback).catch(console.error);

  const channel = supabase
    .channel(`${table}:${filterVal}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `${filterKey}=eq.${filterVal}` },
      () => fetchFn(filterVal).then(callback).catch(console.error)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function upsertUserProfile(userId, { displayName, avatarUrl, favoriteGenres }) {
  if (favoriteGenres) setLocalDailyGenres(userId, favoriteGenres);

  const row = {
    user_id: userId,
    display_name: displayName,
    updated_at: new Date().toISOString(),
  };
  if (avatarUrl) row.avatar_url = avatarUrl;
  if (favoriteGenres) row.favorite_genres = favoriteGenres;

  const { error } = await supabase.from('user_profiles').upsert(row, { onConflict: 'user_id' });
  if (error && !isMissingTableError(error)) throw error;
}

export async function getUserProfile(userId) {
  const localGenres = getLocalDailyGenres(userId);

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return localGenres?.length
          ? { userId, favoriteGenres: localGenres }
          : null;
      }
      throw error;
    }

    if (!data) {
      return localGenres?.length
        ? { userId, favoriteGenres: localGenres }
        : null;
    }

    return {
      userId: data.user_id,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      favoriteGenres: data.favorite_genres?.length ? data.favorite_genres : (localGenres ?? []),
    };
  } catch (err) {
    if (isMissingTableError(err) && localGenres?.length) {
      return { userId, favoriteGenres: localGenres };
    }
    if (isMissingTableError(err)) return null;
    throw err;
  }
}

export async function fetchTodaySwipeCount(userId) {
  const today = todayDateString();
  const local = getLocalTodaySwipes(userId, today).length;

  try {
    const { count, error } = await supabase
      .from('user_swipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('swipe_date', today);

    if (error) {
      if (isMissingTableError(error)) return local;
      throw error;
    }
    return Math.max(count ?? 0, local);
  } catch (err) {
    if (isMissingTableError(err)) return local;
    throw err;
  }
}

export async function fetchMemberSwipeHistories(userIds) {
  if (userIds.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('user_swipes')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
    return (data ?? []).map(mapUserSwipe);
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

function mapUserSwipe(row) {
  return {
    userId: row.user_id,
    movieId: row.movie_id,
    title: row.title,
    posterUrl: row.poster_url,
    genres: row.genres ?? [],
    vote: row.vote,
    swipeDate: row.swipe_date,
  };
}

export async function saveUserSwipe(userId, movie, vote) {
  const today = todayDateString();
  addLocalSwipe(userId, today, {
    movieId: movie.id,
    title: movie.title,
    vote,
  });

  const { error } = await supabase.from('user_swipes').insert({
    user_id: userId,
    movie_id: movie.id,
    title: movie.title,
    poster_url: movie.posterUrl,
    genres: movie.genres ?? [],
    vote,
    swipe_date: today,
  });
  if (error && !isMissingTableError(error)) throw error;
}

export async function fetchDailyDeck(userId, genreNames) {
  const today = todayDateString();
  let exclude = new Set();

  try {
    const { data: swipedToday, error } = await supabase
      .from('user_swipes')
      .select('movie_id')
      .eq('user_id', userId)
      .eq('swipe_date', today);

    if (error && !isMissingTableError(error)) throw error;
    if (swipedToday) {
      exclude = new Set(swipedToday.map((r) => r.movie_id));
    }
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }

  for (const s of getLocalTodaySwipes(userId, today)) {
    exclude.add(s.movieId);
  }

  const remaining = DAILY_SWIPE_LIMIT - exclude.size;
  if (remaining <= 0) return [];

  const genres = genreNames?.length ? genreNames : ['Drama', 'Comedy', 'Action'];
  let pool = await fetchMoviesByGenres(genres, 20);
  if (pool.length === 0) pool = mockMovies.slice(0, 10);

  return pool.filter((m) => !exclude.has(m.id)).slice(0, 1);
}

function mapMessage(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    body: row.body,
    createdAt: row.created_at,
  };
}

async function fetchMessages(roomId) {
  const { data, error } = await supabase
    .from('room_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map(mapMessage);
}

export async function sendChatMessage(roomId, userId, displayName, avatarUrl, body) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const { error } = await supabase.from('room_messages').insert({
    room_id: roomId,
    user_id: userId,
    display_name: displayName,
    avatar_url: avatarUrl,
    body: trimmed.slice(0, 500),
  });
  if (error) throw error;
}

export function subscribeChat(roomId, callback) {
  return subscribeTable('room_messages', 'room_id', roomId, fetchMessages, callback);
}

function mapDailyPick(row) {
  return {
    roomId: row.room_id,
    pickDate: row.pick_date,
    id: row.movie_id,
    title: row.title,
    posterUrl: row.poster_url,
    overview: row.overview,
    tmdbId: row.tmdb_id,
    genres: row.genres ?? [],
    aiReason: row.ai_reason,
    generatedAt: row.generated_at,
  };
}

function mapDailyVote(row) {
  return {
    userId: row.user_id,
    vote: row.vote,
    pickDate: row.pick_date,
  };
}

export async function fetchDailyPick(roomId, pickDate = todayDateString()) {
  const { data, error } = await supabase
    .from('room_daily_picks')
    .select('*')
    .eq('room_id', roomId)
    .eq('pick_date', pickDate)
    .maybeSingle();
  if (error && !isMissingTableError(error)) throw error;
  return data ? mapDailyPick(data) : null;
}

export async function fetchDailyVotes(roomId, pickDate = todayDateString()) {
  const { data, error } = await supabase
    .from('room_daily_votes')
    .select('*')
    .eq('room_id', roomId)
    .eq('pick_date', pickDate);
  if (error && !isMissingTableError(error)) throw error;
  return (data ?? []).map(mapDailyVote);
}

export async function insertDailyPick(roomId, pickDate, movie, aiReason) {
  const { error } = await supabase.from('room_daily_picks').insert({
    room_id: roomId,
    pick_date: pickDate,
    movie_id: movie.id,
    title: movie.title,
    poster_url: movie.posterUrl,
    overview: movie.overview,
    tmdb_id: movie.tmdbId ?? null,
    genres: movie.genres ?? [],
    ai_reason: aiReason,
  });
  if (error && !isMissingTableError(error)) throw error;
}

export async function castDailyVote(roomId, userId, vote, pickDate = todayDateString()) {
  const { error } = await supabase.from('room_daily_votes').upsert(
    {
      room_id: roomId,
      pick_date: pickDate,
      user_id: userId,
      vote,
    },
    { onConflict: 'room_id,pick_date,user_id' }
  );
  if (error && !isMissingTableError(error)) throw error;
}

export function subscribeDailyPick(roomId, pickDate, callback) {
  fetchDailyPick(roomId, pickDate).then(callback).catch(console.error);

  const channel = supabase
    .channel(`daily_pick:${roomId}:${pickDate}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_daily_picks', filter: `room_id=eq.${roomId}` },
      () => fetchDailyPick(roomId, pickDate).then(callback).catch(console.error)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeDailyVotes(roomId, pickDate, callback) {
  fetchDailyVotes(roomId, pickDate).then(callback).catch(console.error);

  const channel = supabase
    .channel(`daily_votes:${roomId}:${pickDate}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_daily_votes', filter: `room_id=eq.${roomId}` },
      () => fetchDailyVotes(roomId, pickDate).then(callback).catch(console.error)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function summarizeTasteFromSwipes(swipes, users) {
  const byUser = {};
  for (const u of users) {
    byUser[u.id] = { name: u.displayName, likes: [], dislikes: [] };
  }
  for (const s of swipes) {
    const bucket = byUser[s.userId];
    if (!bucket) continue;
    if (isPositiveVote(s.vote)) bucket.likes.push(s.title);
    else bucket.dislikes.push(s.title);
  }
  return byUser;
}
