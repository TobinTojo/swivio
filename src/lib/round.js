/** Group swipe round — everyone sees the same card until all vote */

export function sortMoviesByRound(movies) {
  return [...movies].sort((a, b) => {
    const ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return ta - tb || String(a.id).localeCompare(String(b.id));
  });
}

export function getVotersForMovie(votes, movieId) {
  return new Set(votes.filter((v) => v.movieId === movieId).map((v) => v.userId));
}

/**
 * Active round for the room: earliest movie not yet voted on by everyone.
 * If all movies are complete, returns needsNext so the group queues one AI pick.
 */
export function getActiveRound(movies, votes, users) {
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0 || movies.length === 0) return null;

  const sorted = sortMoviesByRound(movies);

  for (const movie of sorted) {
    const voters = getVotersForMovie(votes, movie.id);
    const allVoted = userIds.every((id) => voters.has(id));
    if (!allVoted) {
      return {
        movie,
        allVoted: false,
        waitingFor: users.filter((u) => !voters.has(u.id)),
        votedCount: voters.size,
        totalVoters: userIds.length,
      };
    }
  }

  return {
    movie: null,
    allVoted: true,
    needsNext: true,
    lastMovie: sorted[sorted.length - 1],
  };
}

/** User who triggers the next AI pick (deterministic — avoids duplicate appends) */
export function getRoundAppointer(users) {
  if (!users?.length) return null;
  return [...users].sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? null;
}

/** Latest vote on a movie (for AI context) */
export function getLastVoteForMovie(votes, movieId) {
  const movieVotes = votes.filter((v) => v.movieId === movieId);
  return movieVotes[movieVotes.length - 1]?.vote ?? null;
}
