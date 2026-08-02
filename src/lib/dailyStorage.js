/** localStorage fallback when daily Supabase tables are not migrated yet */

const GENRES_KEY = (userId) => `swivio_daily_genres_${userId}`;
const SWIPES_KEY = (userId, date) => `swivio_daily_swipes_${userId}_${date}`;

export function getLocalDailyGenres(userId) {
  try {
    const raw = localStorage.getItem(GENRES_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLocalDailyGenres(userId, genres) {
  localStorage.setItem(GENRES_KEY(userId), JSON.stringify(genres));
}

export function getLocalTodaySwipes(userId, date) {
  try {
    const raw = localStorage.getItem(SWIPES_KEY(userId, date));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addLocalSwipe(userId, date, swipe) {
  const list = getLocalTodaySwipes(userId, date);
  list.push(swipe);
  localStorage.setItem(SWIPES_KEY(userId, date), JSON.stringify(list));
}

export { isMissingTableError } from './dbErrors.js';
