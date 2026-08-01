import { useEffect, useState } from 'react';
import { fetchMovieDetails } from '../lib/tmdb.js';
import { formatCount } from '../lib/format.js';
import { IconStar, IconTrending } from './Icons.jsx';

function formatRelease(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function Section({ title, children }) {
  return (
    <section className="movie-card__section">
      <h4 className="movie-card__section-title">{title}</h4>
      <div className="movie-card__section-body">{children}</div>
    </section>
  );
}

export default function MovieCard({
  movie,
  overlay,
  overlayText: label,
  onPosterPointerDown,
  onPosterPointerMove,
  onPosterPointerUp,
  onPosterPointerCancel,
}) {
  const poster = movie.posterUrl || '/favicon.svg';
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(Boolean(movie.tmdbId));

  useEffect(() => {
    if (!movie.tmdbId) {
      setLoadingDetails(false);
      return;
    }

    let cancelled = false;
    setLoadingDetails(true);

    fetchMovieDetails(movie.tmdbId)
      .then((data) => {
        if (!cancelled) setDetails(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => { cancelled = true; };
  }, [movie.tmdbId]);

  const genres = details?.genres?.length ? details.genres : movie.genres || [];
  const overview = details?.overview || movie.overview;
  const voteAvg = details?.voteAverage || movie.raw?.vote_average?.toFixed?.(1);
  const voteCount = details?.voteCount ?? movie.raw?.vote_count;
  const isTrending = (details?.popularity ?? movie.raw?.popularity ?? 0) >= 40;
  const runtime = details?.runtime;

  return (
    <div className="movie-card">
      {overlay && (
        <div className={`swipe-overlay swipe-overlay--${overlay}`}>
          {label ?? (overlay === 'like' ? 'LIKE' : 'NOPE')}
        </div>
      )}

      <div
        className="movie-card__poster-wrap"
        onPointerDown={onPosterPointerDown}
        onPointerMove={onPosterPointerMove}
        onPointerUp={onPosterPointerUp}
        onPointerCancel={onPosterPointerCancel}
      >
        <img className="movie-card__poster" src={poster} alt={movie.title} draggable={false} />
      </div>

      <div className="movie-card__body">
        <div className="movie-card__header">
          <div className="movie-card__title-row">
            <h3 className="movie-card__title">{movie.title}</h3>
            {movie.aiRecommended && <span className="badge badge--ai">✨ AI pick</span>}
          </div>
          <hr className="movie-card__divider" />

          <div className="movie-card__badges">
            {voteAvg && (
              <span className="movie-card__badge movie-card__badge--gold">
                <IconStar className="movie-card__badge-icon" />
                {voteAvg}
              </span>
            )}
            {formatCount(voteCount) && (
              <span className="movie-card__badge movie-card__badge--blue">
                {formatCount(voteCount)} ratings
              </span>
            )}
            {isTrending && (
              <span className="movie-card__badge movie-card__badge--pink">
                <IconTrending className="movie-card__badge-icon" />
                Trending
              </span>
            )}
            {runtime && (
              <span className="movie-card__badge movie-card__badge--purple">
                🎬 {runtime}
              </span>
            )}
          </div>

          {movie.releaseDate && (
            <p className="movie-card__released">
              Released: <strong>{formatRelease(movie.releaseDate)}</strong>
            </p>
          )}
        </div>

        <div className="movie-card__scroll">
          <Section title="Synopsis">
            <p>{overview || 'No synopsis available.'}</p>
          </Section>

          <Section title="Genres">
            {genres.length > 0 ? (
              <div className="movie-card__tags">
                {genres.map((g) => (
                  <span key={g} className="movie-card__tag">{g}</span>
                ))}
              </div>
            ) : (
              <p className="movie-card__muted">Unknown</p>
            )}
          </Section>

          <Section title="Reviews">
            {loadingDetails ? (
              <p className="movie-card__muted">Loading reviews…</p>
            ) : details?.reviews?.length > 0 ? (
              <ul className="movie-card__reviews">
                {details.reviews.map((r) => (
                  <li key={r.author} className="movie-card__review">
                    <strong>{r.author}</strong>
                    <p>{r.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="movie-card__muted">No reviews available.</p>
            )}
          </Section>

          <Section title="Available On">
            {details?.streaming?.length > 0 ? (
              <div className="movie-card__tags">
                {details.streaming.map((s) => (
                  <span key={s} className="movie-card__tag movie-card__tag--stream">{s}</span>
                ))}
              </div>
            ) : (
              <p className="movie-card__muted">Not available on any platform.</p>
            )}
          </Section>

          <Section title="Similar Movies">
            {details?.similar?.length > 0 ? (
              <ul className="movie-card__similar">
                {details.similar.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="movie-card__muted">No recommendations available.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
