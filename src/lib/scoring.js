import { VOTE, isPositiveVote, isNegativeVote } from './votes.js';

/**
 * Group match score 0–100: average of each person's sentiment.
 * Like / Watched & loved → 100, Dislike / Watched & disliked → 0.
 * Unanimous likes = 100% (not 75% under the old weighted formula).
 */
export function groupMovieScore(movieId, votes) {
  const movieVotes = votes.filter((v) => v.movieId === movieId);
  if (movieVotes.length === 0) return 0;

  const perPerson = movieVotes.map((v) => {
    if (v.vote === VOTE.WATCHED_ENJOYED || v.vote === VOTE.LIKE) return 100;
    if (v.vote === VOTE.WATCHED_DISLIKED || v.vote === VOTE.DISLIKE) return 0;
    return 50;
  });

  return Math.round(perPerson.reduce((a, b) => a + b, 0) / perPerson.length);
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

function movieVoteStats(votes, movieId) {
  const movieVotes = votes.filter((v) => v.movieId === movieId);
  return {
    voteCount: movieVotes.length,
    positiveCount: movieVotes.filter((v) => isPositiveVote(v.vote)).length,
    negativeCount: movieVotes.filter((v) => isNegativeVote(v.vote)).length,
  };
}

/** Rank movies by group score — only titles the group has voted on */
export function rankMatches(movies, votes, roomSize = null) {
  return movies
    .map((movie) => {
      const stats = movieVoteStats(votes, movie.id);
      return {
        ...movie,
        score: groupMovieScore(movie.id, votes),
        likeCount: countVotesForMovie(votes, movie.id, [VOTE.LIKE]),
        dislikeCount: countVotesForMovie(votes, movie.id, [VOTE.DISLIKE]),
        watchedEnjoyedCount: countVotesForMovie(votes, movie.id, [VOTE.WATCHED_ENJOYED]),
        watchedDislikedCount: countVotesForMovie(votes, movie.id, [VOTE.WATCHED_DISLIKED]),
        positiveCount: stats.positiveCount,
        negativeCount: stats.negativeCount,
        voteCount: stats.voteCount,
        roomSize,
      };
    })
    .filter((movie) => movie.voteCount > 0)
    .sort((a, b) => b.score - a.score || b.positiveCount - a.positiveCount);
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
