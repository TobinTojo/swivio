import { VOTE } from '../lib/votes.js';

export default function WatchedModal({ movie, onClose, onChoose }) {
  if (!movie) return null;

  return (
    <div className="watched-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="watched-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="watched-modal-title"
      >
        <button type="button" className="watched-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <img
          className="watched-modal__poster"
          src={movie.posterUrl || '/favicon.svg'}
          alt=""
        />
        <div className="watched-modal__body">
          <h3 id="watched-modal-title" className="watched-modal__title">
            How did you like this show?
          </h3>
          <div className="watched-modal__actions">
            <button
              type="button"
              className="watched-modal__btn watched-modal__btn--love"
              onClick={() => onChoose(VOTE.WATCHED_ENJOYED)}
            >
              <span className="watched-modal__btn-icon">❤️</span>
              Loved it
            </button>
            <button
              type="button"
              className="watched-modal__btn watched-modal__btn--nope"
              onClick={() => onChoose(VOTE.WATCHED_DISLIKED)}
            >
              <span className="watched-modal__btn-icon">💔</span>
              Not my style
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
