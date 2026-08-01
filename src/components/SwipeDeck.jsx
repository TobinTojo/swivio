import { useState, useRef, useCallback, useMemo } from 'react';
import MovieCard from './MovieCard.jsx';
import WatchedModal from './WatchedModal.jsx';
import { getActiveRound, getVotersForMovie } from '../lib/round.js';
import { VOTE, voteOverlay, overlayText } from '../lib/votes.js';

const SWIPE_THRESHOLD = 80;

export default function SwipeDeck({
  movies,
  votes,
  users,
  userId,
  onVote,
  fetchingNext,
}) {
  const round = useMemo(
    () => getActiveRound(movies, votes, users),
    [movies, votes, users]
  );

  const current = round?.movie ?? null;
  const userHasVoted = current
    ? getVotersForMovie(votes, current.id).has(userId)
    : false;
  const waitingForOthers = Boolean(current && userHasVoted && !round.allVoted);

  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [overlay, setOverlay] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [showWatchedModal, setShowWatchedModal] = useState(false);
  const startRef = useRef(null);

  const resetDrag = useCallback(() => {
    setDrag({ x: 0, y: 0, active: false });
    setOverlay(null);
    startRef.current = null;
  }, []);

  const commitVote = useCallback(
    async (vote, animateSwipe = true) => {
      if (!current || animating || fetchingNext || userHasVoted || waitingForOthers) return;
      setAnimating(true);
      setShowWatchedModal(false);

      if (animateSwipe) {
        const dir = vote > 0 ? 1 : -1;
        setDrag({ x: dir * 400, y: 0, active: false });
        setOverlay(voteOverlay(vote));
      } else {
        setOverlay(voteOverlay(vote));
      }

      try {
        await onVote(current.id, vote);
      } finally {
        setTimeout(() => {
          resetDrag();
          setAnimating(false);
        }, animateSwipe ? 250 : 150);
      }
    },
    [current, animating, fetchingNext, userHasVoted, waitingForOthers, onVote, resetDrag]
  );

  const onPosterPointerDown = (e) => {
    if (animating || fetchingNext || !current || userHasVoted || waitingForOthers) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag((d) => ({ ...d, active: true }));
  };

  const onPosterPointerMove = (e) => {
    if (!startRef.current || animating || userHasVoted) return;
    const dx = e.clientX - startRef.current.x;
    const dy = (e.clientY - startRef.current.y) * 0.3;
    setDrag({ x: dx, y: dy, active: true });
    if (dx > 40) setOverlay('like');
    else if (dx < -40) setOverlay('nope');
    else setOverlay(null);
  };

  const onPosterPointerUp = () => {
    if (!startRef.current || animating || userHasVoted) return;
    const dx = drag.x;
    if (dx > SWIPE_THRESHOLD) commitVote(VOTE.LIKE);
    else if (dx < -SWIPE_THRESHOLD) commitVote(VOTE.DISLIKE);
    else resetDrag();
  };

  const handleWatchedChoose = (vote) => {
    commitVote(vote, false);
  };

  if (fetchingNext || round?.needsNext) {
    return (
      <div className="swipe-deck swipe-deck--empty">
        <div className="empty-state">
          <span className="empty-state__icon">✨</span>
          <h3>Finding your next pick…</h3>
          <p>Everyone swiped — Groq is choosing the next movie for your group.</p>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="swipe-deck swipe-deck--empty">
        <div className="empty-state">
          <span className="empty-state__icon">🎬</span>
          <h3>All caught up!</h3>
          <p>Check the Matches tab to see what your group picked.</p>
        </div>
      </div>
    );
  }

  const rotation = drag.x * 0.08;
  const frontStyle = {
    transform: waitingForOthers ? 'none' : `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`,
    transition: drag.active ? 'none' : 'transform 0.25s ease',
  };

  const isDragging = drag.active || animating;
  const disabled = animating || fetchingNext || userHasVoted || waitingForOthers;

  return (
    <div className="swipe-deck">
      <div className="swipe-deck__counter">
        {round.votedCount}/{round.totalVoters} swiped this card
      </div>

      {waitingForOthers && (
        <div className="swipe-deck__waiting">
          <p className="swipe-deck__waiting-title">Waiting for everyone to swipe</p>
          <p className="swipe-deck__waiting-names">
            Still waiting: {round.waitingFor.map((u) => u.displayName).join(', ')}
          </p>
        </div>
      )}

      <div className={`swipe-deck__stack ${isDragging ? 'swipe-deck__stack--dragging' : ''} ${waitingForOthers ? 'swipe-deck__stack--waiting' : ''}`}>
        <div className="swipe-deck__card swipe-deck__card--front" style={frontStyle}>
          <div className="swipe-card-shell">
            <MovieCard
              movie={current}
              overlay={waitingForOthers ? 'waiting' : overlay}
              overlayText={waitingForOthers ? 'WAITING' : overlay ? overlayText(overlay) : null}
              onPosterPointerDown={onPosterPointerDown}
              onPosterPointerMove={onPosterPointerMove}
              onPosterPointerUp={onPosterPointerUp}
              onPosterPointerCancel={resetDrag}
            />

            <div className="swipe-card-actions">
              <div className="swipe-card-actions__hints">
                <span>👎 Pass</span>
                <span>👍 Like</span>
              </div>
              <div className="swipe-card-actions__buttons">
                <button
                  type="button"
                  className="swipe-action swipe-action--pass"
                  onClick={() => commitVote(VOTE.DISLIKE)}
                  disabled={disabled}
                  aria-label="Pass"
                >
                  👎
                </button>
                <button
                  type="button"
                  className="swipe-action swipe-action--watched"
                  onClick={() => setShowWatchedModal(true)}
                  disabled={disabled}
                >
                  👀 Watched
                </button>
                <button
                  type="button"
                  className="swipe-action swipe-action--like"
                  onClick={() => commitVote(VOTE.LIKE)}
                  disabled={disabled}
                  aria-label="Like"
                >
                  👍
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showWatchedModal && (
        <WatchedModal
          movie={current}
          onClose={() => setShowWatchedModal(false)}
          onChoose={handleWatchedChoose}
        />
      )}
    </div>
  );
}
