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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [swipeCount, setSwipeCount] = useState(0);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchGenres().then(setGenres).catch(console.error);
  }, []);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      const profile = await getUserProfile(userId);
      if (profile?.favoriteGenres?.length) {
        setSelectedGenres(profile.favoriteGenres);
      }
      const count = await fetchTodaySwipeCount(userId);
      setSwipeCount(count);
      setProfileLoaded(true);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [userId]);

  const loadNext = useCallback(async (genreList) => {
    if (!userId || !genreList.length) return;
    const deck = await fetchDailyDeck(userId, genreList);
    setCurrent(deck[0] ?? null);
    if (!deck[0]) setDone(true);
  }, [userId]);

  useEffect(() => {
    if (!profileLoaded || selectedGenres.length === 0) return;
    if (swipeCount >= DAILY_SWIPE_LIMIT) {
      setDone(true);
      return;
    }
    loadNext(selectedGenres);
  }, [profileLoaded, selectedGenres, swipeCount, loadNext]);

  async function saveGenres() {
    if (selectedGenres.length === 0) return;
    await upsertUserProfile(userId, {
      displayName,
      avatarUrl,
      favoriteGenres: selectedGenres,
    });
    setProfileLoaded(true);
  }

  function toggleGenre(name) {
    setSelectedGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  }

  async function handleVote(vote) {
    if (!current || saving) return;
    setSaving(true);
    try {
      await saveUserSwipe(userId, current, vote);
      const count = await fetchTodaySwipeCount(userId);
      setSwipeCount(count);
      setCurrent(null);
      if (count >= DAILY_SWIPE_LIMIT) setDone(true);
      else await loadNext(selectedGenres);
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
      <Navbar variant="landing" avatarUrl={avatarUrl} displayName={displayName} userChip={userChip} />

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

        {selectedGenres.length === 0 && (
          <div className="genre-picker">
            <h2 className="genre-picker__title">Pick your genres first</h2>
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
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={selectedGenres.length === 0 || !isSignedIn}
              onClick={saveGenres}
            >
              Save & start swiping
            </button>
          </div>
        )}

        {selectedGenres.length > 0 && done && (
          <div className="empty-state">
            <span className="empty-state__icon">✅</span>
            <h3>All done for today!</h3>
            <p>Come back tomorrow for more swipes. Join a room for the group daily pick.</p>
            <Link to="/" className="btn btn--secondary">Back home</Link>
          </div>
        )}

        {selectedGenres.length > 0 && !done && loading && (
          <p className="genre-picker__loading">Loading your daily pick…</p>
        )}

        {selectedGenres.length > 0 && !done && current && (
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
