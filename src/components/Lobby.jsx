import { useState } from 'react';
import PeopleList from './PeopleList.jsx';
import { allUsersReady } from '../lib/lobby.js';

export default function Lobby({
  users,
  hostUserId,
  currentUserId,
  isReady,
  onToggleReady,
  onStart,
  starting,
}) {
  const [error, setError] = useState(null);
  const isHost = currentUserId === hostUserId;
  const everyoneReady = allUsersReady(users);
  const readyCount = users.filter((u) => u.isReady).length;

  async function handleStart() {
    setError(null);
    try {
      await onStart();
    } catch (err) {
      setError(err.message || 'Could not start');
    }
  }

  return (
    <div className="lobby">
      <div className="lobby__header">
        <h2>Waiting in the lobby</h2>
        <p>Ready up when you&apos;re set. The host starts once everyone is ready.</p>
      </div>

      <div className="lobby__status">
        <span className="lobby__ready-count">{readyCount}/{users.length} ready</span>
      </div>

      <PeopleList
        users={users}
        hostUserId={hostUserId}
        currentUserId={currentUserId}
        showReady
      />

      <div className="lobby__actions">
        <button
          type="button"
          className={`btn btn--block ${isReady ? 'btn--secondary' : 'btn--primary'}`}
          onClick={onToggleReady}
        >
          {isReady ? 'Cancel ready' : 'Ready up'}
        </button>

        {isHost && (
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={handleStart}
            disabled={!everyoneReady || starting}
          >
            {starting ? 'Starting…' : 'Start session'}
          </button>
        )}

        {!isHost && (
          <p className="lobby__hint">
            {everyoneReady
              ? 'Waiting for the host to start…'
              : 'Waiting for everyone to ready up…'}
          </p>
        )}

        {isHost && !everyoneReady && users.length > 0 && (
          <p className="lobby__hint">Everyone must ready up before you can start.</p>
        )}

        {error && <p className="alert alert--error">{error}</p>}
      </div>
    </div>
  );
}
