import { userCompatibility } from '../lib/scoring.js';

export default function Scoreboard({ users, votes, hostUserId, currentUserId }) {
  if (users.length === 0) {
    return <div className="empty-state"><p>No users in room yet.</p></div>;
  }

  const refUserId = hostUserId || users[0]?.id;

  return (
    <div className="scoreboard">
      <p className="scoreboard__hint">
        Agreement rate vs {users.find((u) => u.id === refUserId)?.displayName || 'host'}
      </p>
      <ul className="scoreboard__list">
        {users.map((user) => {
          const score = userCompatibility(user.id, refUserId, votes);
          const isSelf = user.id === currentUserId;
          const isHost = user.id === hostUserId;

          return (
            <li key={user.id} className={`scoreboard__row ${isSelf ? 'scoreboard__row--self' : ''}`}>
              <div className="scoreboard__user">
                <span className="scoreboard__avatar">
                  {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                </span>
                <span className="scoreboard__name">
                  {user.displayName}
                  {isHost && <span className="badge badge--host">Host</span>}
                  {isSelf && <span className="badge badge--you">You</span>}
                </span>
              </div>
              <span className={`scoreboard__score ${score == null ? 'scoreboard__score--na' : ''}`}>
                {score == null ? '—' : `${score}%`}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="scoreboard__group">
        <h4>Group Majority</h4>
        <ul className="scoreboard__list">
          {users.map((user) => {
            const majorityScore = computeMajorityCompatibility(user.id, votes);
            return (
              <li key={`maj-${user.id}`} className="scoreboard__row">
                <span className="scoreboard__name">{user.displayName}</span>
                <span className={`scoreboard__score ${majorityScore == null ? 'scoreboard__score--na' : ''}`}>
                  {majorityScore == null ? '—' : `${majorityScore}%`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** How often user agrees with the majority vote on each movie */
function computeMajorityCompatibility(userId, votes) {
  const byMovie = {};

  for (const v of votes) {
    if (!byMovie[v.movieId]) byMovie[v.movieId] = [];
    byMovie[v.movieId].push(v);
  }

  let agreements = 0;
  let common = 0;

  for (const movieVotes of Object.values(byMovie)) {
    const mine = movieVotes.find((v) => v.userId === userId);
    if (!mine) continue;

    const positive = movieVotes.filter((v) => v.vote > 0).length;
    const negative = movieVotes.filter((v) => v.vote < 0).length;
    if (positive === negative) continue;

    const majorityPositive = positive > negative;
    common += 1;
    const minePositive = mine.vote > 0;
    if (minePositive === majorityPositive) agreements += 1;
  }

  if (common === 0) return null;
  return Math.round((agreements / common) * 100);
}
