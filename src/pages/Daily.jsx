import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import MovieCard from '../components/MovieCard.jsx';
import { fetchGenres } from '../lib/tmdb.js';
import {
  getUserProfile,
  upsertUserProfile,
  fetchDailyDeck,
  saveUserSwipe,
  fetchTodaySwipeCount,
} from '../lib/daily.js';
import { DAILY_SWIPE_LIMIT } from '../lib/dailyUtils.js';
import { VOTE } from '../lib/votes.js';

export default function Daily() {
  const { userId, displayName, avatarUrl, isSignedIn } = useAuth();
  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [genresReady, setGenresReady] = useState(false);
  const [swipeCount, setSwipeCount] = useState(0);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingCard, setLoadingCard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGenres().then(setGenres).catch(console.error);
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const profile = await getUserProfile(userId);
        if (profile?.favoriteGenres?.length) {
          setSelectedGenres(profile.favoriteGenres);
          setGenresReady(true);
        }
        const count = await fetchTodaySwipeCount(userId);
        setSwipeCount(count);
        if (count >= DAILY_SWIPE_LIMIT) setDone(true);
      } catch (err) {
        setError(err.message || 'Failed to load daily profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const loadNext = useCallback(async (genreList) => {
    if (!userId || !genreList.length) return;
    setLoadingCard(true);
    setError(null);
    try {
      const deck = await fetchDailyDeck(userId, genreList);
      setCurrent(deck[0] ?? null);
      if (!deck[0]) setDone(true);
    } catch (err) {
      setError(err.message || 'Failed to load movies');
    } finally {
      setLoadingCard(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!genresReady || selectedGenres.length === 0) return;
    if (swipeCount >= DAILY_SWIPE_LIMIT) {
      setDone(true);
      return;
    }
    if (!current && !loadingCard) loadNext(selectedGenres);
  }, [genresReady, selectedGenres, swipeCount, current, loadingCard, loadNext]);

  async function saveGenres() {
    if (selectedGenres.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await upsertUserProfile(userId, {
        displayName,
        avatarUrl,
        favoriteGenres: selectedGenres,
      });
      setGenresReady(true);
    } catch (err) {
      setError(err.message || 'Failed to save genres');
    } finally {
      setSaving(false);
    }
  }

  function toggleGenre(name) {
    setSelectedGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  }

  async function handleVote(vote) {
    if (!current || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveUserSwipe(userId, current, vote);
      const count = await fetchTodaySwipeCount(userId);
      setSwipeCount(count);
      setCurrent(null);
      if (count >= DAILY_SWIPE_LIMIT) setDone(true);
      else await loadNext(selectedGenres);
    } catch (err) {
      setError(err.message || 'Failed to save swipe');
    } finally {
      setSaving(false);
    }
  }

  const userChip = isSignedIn ? (
    <div className="user-chip">
      {avatarUrl && <img className="user-chip__avatar" src={avatarUrl} alt="" />}
      <span className="user-chip__name">{displayName}</span>
    </div>
  ) : null;

  return (
    <div className="daily-page">
      <Navbar variant="landing" displayName={displayName} userChip={userChip} />

      <main className="daily-page__main">
        <header className="daily-page__header">
          <h1>Daily Swipes</h1>
          <p>
            Swipe {DAILY_SWIPE_LIMIT} films on your own each day. Your votes train the AI for your
            group&apos;s daily movie pick.
          </p>
          <p className="daily-page__progress">
            Today: {swipeCount}/{DAILY_SWIPE_LIMIT} swiped
          </p>
        </header>

        {!isSignedIn && (
          <p className="alert alert--warn">
            <Link to="/">Sign in</Link> to save your daily preferences.
          </p>
        )}

        {error && <p className="alert alert--error">{error}</p>}

        {!genresReady && (
          <div className="genre-picker">
            <h2 className="genre-picker__title">Pick your genres first</h2>
            <p className="genre-picker__subtitle">
              Choose a few genres you enjoy — we&apos;ll pull daily movies to swipe on.
            </p>
            <div className="genre-picker__grid">
              {genres.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`genre-chip ${selectedGenres.includes(name) ? 'genre-chip--selected' : ''}`}
                  onClick={() => toggleGenre(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="genre-picker__count">
              {selectedGenres.length} selected
            </p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={selectedGenres.length === 0 || !isSignedIn || saving}
              onClick={saveGenres}
            >
              {saving ? 'Saving…' : 'Save & start swiping'}
            </button>
          </div>
        )}

        {genresReady && done && (
          <div className="empty-state">
            <span className="empty-state__icon">✅</span>
            <h3>All done for today!</h3>
            <p>Come back tomorrow for more swipes. Join a room for the group daily pick.</p>
            <Link to="/" className="btn btn--secondary">Back home</Link>
          </div>
        )}

        {genresReady && !done && (loading || loadingCard) && !current && (
          <p className="genre-picker__loading">Loading your daily pick…</p>
        )}

        {genresReady && !done && current && (
          <div className="daily-page__card">
            <MovieCard movie={current} />
            <div className="swipe-card-actions">
              <div className="swipe-card-actions__buttons">
                <button
                  type="button"
                  className="swipe-action swipe-action--pass"
                  onClick={() => handleVote(VOTE.DISLIKE)}
                  disabled={saving}
                >
                  👎
                </button>
                <button
                  type="button"
                  className="swipe-action swipe-action--like"
                  onClick={() => handleVote(VOTE.LIKE)}
                  disabled={saving}
                >
                  👍
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
