import { useState, useRef, useCallback, useMemo } from 'react';
import MovieCard from './MovieCard.jsx';
import WatchedModal from './WatchedModal.jsx';
import { VOTE, voteOverlay, overlayText } from '../lib/votes.js';

const SWIPE_THRESHOLD = 80;

export default function SwipeDeck({
  movies,
  votes,
  userId,
  onVote,
  queueHead,
  fetchingNext,
}) {
  const votedIds = useMemo(
    () => new Set(votes.filter((v) => v.userId === userId).map((v) => v.movieId)),
    [votes, userId]
  );

  const baseDeck = useMemo(
    () => movies.filter((m) => !votedIds.has(m.id)),
    [movies, votedIds]
  );

  const deck = useMemo(() => {
    if (queueHead && !votedIds.has(queueHead.id)) {
      return [queueHead, ...baseDeck.filter((m) => m.id !== queueHead.id)];
    }
    return baseDeck;
  }, [baseDeck, queueHead, votedIds]);

  const current = deck[0];

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
      if (!current || animating || fetchingNext) return;
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
    [current, animating, fetchingNext, onVote, resetDrag]
  );

  const onPosterPointerDown = (e) => {
    if (animating || fetchingNext || !current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag((d) => ({ ...d, active: true }));
  };

  const onPosterPointerMove = (e) => {
    if (!startRef.current || animating) return;
    const dx = e.clientX - startRef.current.x;
    const dy = (e.clientY - startRef.current.y) * 0.3;
    setDrag({ x: dx, y: dy, active: true });
    if (dx > 40) setOverlay('like');
    else if (dx < -40) setOverlay('nope');
    else setOverlay(null);
  };

  const onPosterPointerUp = () => {
    if (!startRef.current || animating) return;
    const dx = drag.x;
    if (dx > SWIPE_THRESHOLD) commitVote(VOTE.LIKE);
    else if (dx < -SWIPE_THRESHOLD) commitVote(VOTE.DISLIKE);
    else resetDrag();
  };

  const handleWatchedChoose = (vote) => {
    commitVote(vote, false);
  };

  if (fetchingNext) {
    return (
      <div className="swipe-deck swipe-deck--empty">
        <div className="empty-state">
          <span className="empty-state__icon">✨</span>
          <h3>Finding your next pick…</h3>
          <p>Groq is choosing a movie based on your group&apos;s taste.</p>
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
    transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`,
    transition: drag.active ? 'none' : 'transform 0.25s ease',
  };

  const votedCount = movies.filter((m) => votedIds.has(m.id)).length;
  const isDragging = drag.active || animating;
  const disabled = animating || fetchingNext;

  return (
    <div className="swipe-deck">
      <div className="swipe-deck__counter">
        {votedCount + 1} swiped · {deck.length} left
      </div>

      <div className={`swipe-deck__stack ${isDragging ? 'swipe-deck__stack--dragging' : ''}`}>
        <div className="swipe-deck__card swipe-deck__card--front" style={frontStyle}>
          <div className="swipe-card-shell">
            <MovieCard
              movie={current}
              overlay={overlay}
              overlayText={overlay ? overlayText(overlay) : null}
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
