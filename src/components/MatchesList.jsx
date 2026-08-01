export default function MatchesList({ matches, movieReasons }) {
  if (matches.length === 0) {
    return (
      <div className="empty-state">
        <p>No votes yet. Start swiping to find matches!</p>
      </div>
    );
  }

  return (
    <ul className="matches-list">
      {matches.map((movie, i) => (
        <li key={movie.id} className="matches-list__item">
          <span className="matches-list__rank">#{i + 1}</span>
          <img
            className="matches-list__poster"
            src={movie.posterUrl || '/favicon.svg'}
            alt=""
          />
          <div className="matches-list__body">
            <div className="matches-list__header">
              <h4>{movie.title}</h4>
              <span className={`score score--${movie.score >= 70 ? 'high' : movie.score >= 50 ? 'mid' : 'low'}`}>
                {movie.score}%
              </span>
            </div>
            <div className="matches-list__stats">
              <span className="stat-like">♥ {movie.positiveCount}</span>
              <span className="stat-dislike">✕ {movie.negativeCount}</span>
              {movie.roomSize > 0 && (
                <span className="stat-voters">{movie.voteCount}/{movie.roomSize} voted</span>
              )}
              {movie.watchedEnjoyedCount > 0 && (
                <span className="stat-seen-like">👁♥ {movie.watchedEnjoyedCount}</span>
              )}
              {movie.watchedDislikedCount > 0 && (
                <span className="stat-seen-dislike">👁✕ {movie.watchedDislikedCount}</span>
              )}
            </div>
            {movieReasons?.[movie.id] && (
              <p className="matches-list__reason">{movieReasons[movie.id]}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
