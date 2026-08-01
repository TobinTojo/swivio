import { useEffect, useState } from 'react';
import { fetchGenres } from '../lib/tmdb.js';
import { saveUserGenres } from '../lib/supabase.js';

const MIN_GENRES = 1;

export default function GenrePicker({ roomId, userId, displayName, avatarUrl, onComplete }) {
  const [genres, setGenres] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGenres()
      .then(setGenres)
      .catch(() => setError('Could not load genres'))
      .finally(() => setLoading(false));
  }, []);

  function toggleGenre(name) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  }

  async function handleSubmit() {
    if (selected.length < MIN_GENRES) {
      setError(`Pick at least ${MIN_GENRES} genre${MIN_GENRES > 1 ? 's' : ''}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveUserGenres(roomId, userId, selected, displayName, avatarUrl);
      onComplete?.(selected);
    } catch (err) {
      setError(err.message || 'Failed to save genres');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="genre-picker">
        <p className="genre-picker__loading">Loading genres…</p>
      </div>
    );
  }

  return (
    <div className="genre-picker">
      <h2 className="genre-picker__title">What do you like to watch?</h2>
      <p className="genre-picker__subtitle">
        Hey {displayName || 'there'} — pick your favorite genres. Your swipe deck will be built from everyone&apos;s picks in this room.
      </p>

      <div className="genre-picker__grid">
        {genres.map((name) => (
          <button
            key={name}
            type="button"
            className={`genre-chip ${selected.includes(name) ? 'genre-chip--selected' : ''}`}
            onClick={() => toggleGenre(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <p className="genre-picker__count">
        {selected.length} selected {selected.length < 3 && '(pick a few for better recommendations)'}
      </p>

      {error && <p className="alert alert--error">{error}</p>}

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={handleSubmit}
        disabled={saving || selected.length < MIN_GENRES}
      >
        {saving ? 'Saving…' : 'Save genres'}
      </button>
    </div>
  );
}
