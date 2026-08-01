import { isAiConfigured, recommendDailyGroupMovie } from './ai.js';
import { lookupMovieByTitle, discoverOneMovie } from './tmdb.js';
import { getGroupGenreNames } from './scoring.js';
import {
  fetchDailyPick,
  insertDailyPick,
  fetchMemberSwipeHistories,
  summarizeTasteFromSwipes,
} from './daily.js';
import { todayDateString } from './dailyUtils.js';

/** Generate today's group pick if missing (host only) */
export async function ensureDailyPick(roomId, users, hostUserId, userId) {
  const pickDate = todayDateString();
  const existing = await fetchDailyPick(roomId, pickDate);
  if (existing) return existing;

  if (userId !== hostUserId) return null;

  const userIds = users.map((u) => u.id);
  const swipes = await fetchMemberSwipeHistories(userIds);
  const tasteByUser = summarizeTasteFromSwipes(swipes, users);
  const groupGenres = getGroupGenreNames(users);

  let movie = null;
  let reason = 'A pick based on your group\'s genres.';

  if (isAiConfigured()) {
    try {
      const suggestion = await recommendDailyGroupMovie({
        users,
        tasteByUser,
        groupGenres,
      });
      movie = await lookupMovieByTitle(suggestion.title, suggestion.year);
      reason = suggestion.reason;
    } catch (err) {
      console.warn('Daily AI pick failed:', err);
    }
  }

  if (!movie) {
    movie = await discoverOneMovie(groupGenres.length ? groupGenres : ['Drama'], []);
  }

  if (!movie) return null;

  await insertDailyPick(roomId, pickDate, movie, reason);
  return fetchDailyPick(roomId, pickDate);
}
