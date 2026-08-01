import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  castDailyVote,
  fetchDailyPick,
  subscribeDailyPick,
  subscribeDailyVotes,
} from '../lib/daily.js';
import { ensureDailyPick } from '../lib/dailyPick.js';
import {
  todayDateString,
  allMembersVotedDaily,
  dailyPickResult,
} from '../lib/dailyUtils.js';
import { VOTE } from '../lib/votes.js';

export default function DailyPickPanel({
  roomId,
  users,
  userId,
  hostUserId,
}) {
  const pickDate = todayDateString();
  const [pick, setPick] = useState(null);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [voting, setVoting] = useState(false);

  const userIds = users.map((u) => u.id);
  const myVote = votes.find((v) => v.userId === userId);
  const allVoted = allMembersVotedDaily(votes, userIds);
  const result = allVoted ? dailyPickResult(votes, userIds) : null;
  const waitingFor = users.filter((u) => !votes.some((v) => v.userId === u.id));

  useEffect(() => {
    const unsubs = [
      subscribeDailyPick(roomId, pickDate, setPick),
      subscribeDailyVotes(roomId, pickDate, setVotes),
    ];
    return () => unsubs.forEach((u) => u());
  }, [roomId, pickDate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        let p = await fetchDailyPick(roomId, pickDate);
        if (!p && users.length > 0) {
          setGenerating(true);
          p = await ensureDailyPick(roomId, users, hostUserId, userId);
        }
        if (!cancelled) setPick(p);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setGenerating(false);
        }
      }
    }

    if (users.length > 0) load();
    return () => { cancelled = true; };
  }, [roomId, pickDate, users, hostUserId, userId]);

  async function handleVote(vote) {
    if (voting || myVote) return;
    setVoting(true);
    try {
      await castDailyVote(roomId, userId, vote, pickDate);
    } finally {
      setVoting(false);
    }
  }

  if (loading || generating) {
    return (
      <div className="daily-pick daily-pick--loading">
        <p>{generating ? '✨ AI is picking today\'s movie…' : 'Loading…'}</p>
      </div>
    );
  }

  if (!pick) {
    return (
      <div className="daily-pick">
        <h2>Today&apos;s pick</h2>
        <p className="daily-pick__hint">
          Swipe on your own in{' '}
          <Link to="/daily">Daily Training</Link>
          {' '}so the AI learns your taste, then the host can generate a pick.
        </p>
        {userId === hostUserId && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              setGenerating(true);
              const p = await ensureDailyPick(roomId, users, hostUserId, userId);
              setPick(p);
              setGenerating(false);
            }}
          >
            Generate today&apos;s pick
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="daily-pick">
      <div className="daily-pick__header">
        <h2>Today&apos;s pick</h2>
        <span className="daily-pick__date">{pickDate}</span>
      </div>

      <div className="daily-pick__card">
        <img
          className="daily-pick__poster"
          src={pick.posterUrl || '/favicon.svg'}
          alt=""
        />
        <div className="daily-pick__info">
          <h3>{pick.title}</h3>
          {pick.aiReason && <p className="daily-pick__reason">{pick.aiReason}</p>}
          {pick.overview && (
            <p className="daily-pick__overview">{pick.overview.slice(0, 200)}…</p>
          )}
        </div>
      </div>

      {!allVoted && (
        <>
          <p className="daily-pick__status">
            {votes.length}/{users.length} voted — everyone must swipe
          </p>

          {myVote ? (
            <div className="daily-pick__waiting">
              <p>You voted — waiting for everyone to swipe</p>
              {waitingFor.length > 0 && (
                <p className="daily-pick__waiting-names">
                  Still waiting: {waitingFor.map((u) => u.displayName).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <div className="daily-pick__actions">
              <button
                type="button"
                className="swipe-action swipe-action--pass"
                onClick={() => handleVote(VOTE.DISLIKE)}
                disabled={voting}
              >
                👎 Pass
              </button>
              <button
                type="button"
                className="swipe-action swipe-action--like"
                onClick={() => handleVote(VOTE.LIKE)}
                disabled={voting}
              >
                👍 Like
              </button>
            </div>
          )}
        </>
      )}

      {result && (
        <div className={`daily-pick__result ${result.approved ? 'daily-pick__result--yes' : 'daily-pick__result--no'}`}>
          <h4>{result.approved ? '🎬 Group approved!' : '😐 Not tonight'}</h4>
          <p>
            {result.likes} liked · {result.dislikes} passed · {result.total} total
          </p>
        </div>
      )}

      <p className="daily-pick__footer">
        Train your taste solo in <Link to="/daily">Daily Swipes</Link> — more swipes = better picks.
      </p>
    </div>
  );
}
