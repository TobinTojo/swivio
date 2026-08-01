import { recommendNextMovieTitle, isAiConfigured } from './ai.js';
import { lookupMovieByTitle, discoverOneMovie } from './tmdb.js';
import { getGroupGenreNames } from './scoring.js';

/**
 * After a swipe, ask Groq for the next movie, look it up on TMDB, and add to the room.
 */
export async function appendRecommendedMovie(supabase, roomId, { movieId, vote, fetchRoomData, insertMovie }) {
  const { users, movies, votes } = await fetchRoomData(roomId);
  const lastMovie = movies.find((m) => m.id === movieId);
  const existingIds = new Set(movies.map((m) => m.id));
  const genreNames = getGroupGenreNames(users);

  let picked = null;

  if (isAiConfigured()) {
    try {
      const suggestion = await recommendNextMovieTitle({
        users,
        movies,
        votes: [...votes, { movieId, vote, userId: 'current' }],
        lastMovie,
        lastVote: vote,
      });

      picked = await lookupMovieByTitle(suggestion.title, suggestion.year);

      // Retry once if duplicate or not found
      if (!picked || existingIds.has(picked.id)) {
        const retry = await recommendNextMovieTitle({
          users,
          movies: [...movies, ...(picked ? [picked] : [])],
          votes: [...votes, { movieId, vote, userId: 'current' }],
          lastMovie,
          lastVote: vote,
        });
        picked = await lookupMovieByTitle(retry.title, retry.year);
      }
    } catch (err) {
      console.warn('AI recommendation failed:', err);
    }
  }

  if (!picked || existingIds.has(picked.id)) {
    picked = await discoverOneMovie(genreNames, [...existingIds]);
  }

  if (!picked || existingIds.has(picked.id)) return null;

  await insertMovie(roomId, { ...picked, aiRecommended: true });
  return picked;
}
