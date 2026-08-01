import { VOTE } from './votes.js';

/**
 * Group match score 0–100 using weighted votes.
 * Watched votes count double (±2) since they're informed opinions.
 */
export function groupMovieScore(movieId, votes) {
  const movieVotes = votes.filter((v) => v.movieId === movieId);
  if (movieVotes.length === 0) return 0;

  const sum = movieVotes.reduce((acc, v) => acc + v.vote, 0);
  const maxAbs = movieVotes.length * 2;
  return Math.round((sum / maxAbs) * 50 + 50);
}

/**
 * Compatibility between two users: agreement rate on movies both voted on.
 * Returns null when there are no common votes.
 */
export function userCompatibility(userId, refUserId, votes) {
  const userVotes = new Map(
    votes.filter((v) => v.userId === userId).map((v) => [v.movieId, v.vote])
  );
  const refVotes = new Map(
    votes.filter((v) => v.userId === refUserId).map((v) => [v.movieId, v.vote])
  );

  let agreements = 0;
  let common = 0;

  for (const [movieId, vote] of userVotes) {
    if (refVotes.has(movieId)) {
      common += 1;
      if (refVotes.get(movieId) === vote) agreements += 1;
    }
  }

  if (common === 0) return null;
  return Math.round((agreements / common) * 100);
}

function countVotesForMovie(votes, movieId, targets) {
  return votes.filter((v) => v.movieId === movieId && targets.includes(v.vote)).length;
}

/** Rank movies by group score, descending */
export function rankMatches(movies, votes) {
  return movies
    .map((movie) => ({
      ...movie,
      score: groupMovieScore(movie.id, votes),
      likeCount: countVotesForMovie(votes, movie.id, [VOTE.LIKE]),
      dislikeCount: countVotesForMovie(votes, movie.id, [VOTE.DISLIKE]),
      watchedEnjoyedCount: countVotesForMovie(votes, movie.id, [VOTE.WATCHED_ENJOYED]),
      watchedDislikedCount: countVotesForMovie(votes, movie.id, [VOTE.WATCHED_DISLIKED]),
    }))
    .sort((a, b) => b.score - a.score || b.likeCount + b.watchedEnjoyedCount - (a.likeCount + a.watchedEnjoyedCount));
}

/** Unique genre names picked by anyone in the room */
export function getGroupGenreNames(users) {
  return [...new Set(users.flatMap((u) => u.favoriteGenres ?? []))];
}

/** Aggregate favorite genres across all users for AI context */
export function aggregateGroupGenres(users) {
  const counts = {};
  for (const user of users) {
    for (const genre of user.favoriteGenres ?? []) {
      counts[genre] = (counts[genre] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}
