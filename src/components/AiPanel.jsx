import { useEffect, useState } from 'react';
import { isAiConfigured, generateGroupSummary, generateMovieReason } from '../lib/ai.js';
import { getAiCache, setAiCache, subscribeAiCache } from '../lib/supabase.js';
import { rankMatches, aggregateGroupGenres } from '../lib/scoring.js';
import { VOTE } from '../lib/votes.js';
import { ROOM_STATUS } from '../lib/lobby.js';

const MIN_VOTES_FOR_AI = 10;

export default function AiPanel({ roomId, roomStatus, movies, votes, users, onReasonsReady }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const enabled = isAiConfigured();
  const totalVotes = votes.length;
  const isSwiping = roomStatus === ROOM_STATUS.SWIPING;
  const canGenerate = enabled && isSwiping && totalVotes >= MIN_VOTES_FOR_AI;
  const groupGenres = aggregateGroupGenres(users);

  useEffect(() => {
    if (!roomId || !canGenerate) return;

    const unsub = subscribeAiCache(roomId, 'room_summary', (cached) => {
      if (cached?.payload) setSummary(cached.payload);
    });

    return unsub;
  }, [roomId, canGenerate]);

  useEffect(() => {
    if (!roomId || !canGenerate || summary) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const cached = await getAiCache(roomId, 'room_summary');
        if (cached?.payload) {
          if (!cancelled) setSummary(cached.payload);
          return;
        }

        const liked = getPositiveMovies(movies, votes);
        const text = await generateGroupSummary(liked, users, groupGenres);
        if (cancelled) return;

        await setAiCache(roomId, 'room_summary', 'room_summary', text);
        setSummary(text);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [roomId, canGenerate, movies, votes, users, groupGenres, summary]);

  useEffect(() => {
    if (!roomId || !canGenerate || !onReasonsReady) return;

    let cancelled = false;

    async function runReasons() {
      const top = rankMatches(movies, votes).slice(0, 5);
      const reasons = {};
      const liked = getPositiveMovies(movies, votes);

      for (const movie of top) {
        const cacheId = `reason_${movie.id}`;
        const cached = await getAiCache(roomId, cacheId);
        if (cached?.payload) {
          reasons[movie.id] = cached.payload;
          continue;
        }

        try {
          const text = await generateMovieReason(movie, liked, users, groupGenres);
          await setAiCache(roomId, cacheId, 'movie_reason', text);
          reasons[movie.id] = text;
        } catch {
          // skip individual failures
        }
      }

      if (!cancelled) onReasonsReady(reasons);
    }

    runReasons();
    return () => { cancelled = true; };
  }, [roomId, canGenerate, movies, votes, users, groupGenres, onReasonsReady]);

  if (!enabled || !isSwiping) return null;

  if (totalVotes < MIN_VOTES_FOR_AI) return null;

  return (
    <div className="ai-panel">
      <div className="ai-panel__header">
        <span className="ai-panel__icon">✨</span>
        <h3>Group Taste Summary</h3>
      </div>
      {groupGenres.length > 0 && (
        <p className="ai-panel__genres">
          Group loves: {groupGenres.slice(0, 5).map((g) => g.name).join(', ')}
        </p>
      )}
      {loading && <p className="ai-panel__loading">Analyzing your group&apos;s taste…</p>}
      {error && <p className="ai-panel__error">{error}</p>}
      {summary && <p className="ai-panel__summary">{summary}</p>}
    </div>
  );
}

function getPositiveMovies(movies, votes) {
  const positiveIds = new Set(
    votes.filter((v) => v.vote === VOTE.LIKE || v.vote === VOTE.WATCHED_ENJOYED).map((v) => v.movieId)
  );
  return movies.filter((m) => positiveIds.has(m.id));
}
