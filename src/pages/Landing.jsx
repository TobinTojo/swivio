import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  isSupabaseConfigured,
  generateRoomId,
  createRoom,
  joinRoomUser,
  roomExists,
} from '../lib/supabase.js';
import { isTmdbConfigured } from '../lib/tmdb.js';
import { isAiConfigured } from '../lib/ai.js';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import { IconFilm, IconUsers, IconSparkles, IconHeart } from '../components/Icons.jsx';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const HERO_POSTERS = [
  '/9gk7adHYeDvHkCSEqUS7Mit8YY.jpg',
  '/d5NXSklXjb0BYFO4k0HV0E8BgzL.jpg',
  '/1E5baAaEse26fej7uHcjOgKM2v.jpg',
  '/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg',
  '/qJ2tW6WMUDux911r7o7s8pB0Q4.jpg',
  '/b0Pl0UF39NVI25F0AA11XAprE8S.jpg',
  '/gEU2QniE6E77PG6dW1QY4mFp0An.jpg',
  '/or06G3We4i5jFzWpX1Nc8B697s.jpg',
  '/8Gxv8gSFC6QYT3TV3H3xsNF7yt.jpg',
  '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  '/6oom5QYQ2yQn8li0619sPxWaf0.jpg',
  '/tmU7GElvbSMSQXLdoLSHm7c6K3x.jpg',
];

const FEATURES = [
  {
    icon: IconUsers,
    title: 'Swipe together',
    text: 'Everyone joins one room and votes in real time — like a movie-night jam session.',
  },
  {
    icon: IconSparkles,
    title: 'AI-powered picks',
    text: 'After each swipe, Groq reads the room and queues the next film your group might love.',
  },
  {
    icon: IconHeart,
    title: 'Find your match',
    text: 'See group scores, compatibility, and the films you all actually agree on.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, userId, displayName, avatarUrl, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const supabaseReady = isSupabaseConfigured();
  const redirectFrom = location.state?.from;
  const pendingRoom = redirectFrom?.startsWith('/room/')
    ? redirectFrom.replace('/room/', '')
    : '';

  useEffect(() => {
    if (displayName) setName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (pendingRoom) setJoinCode(pendingRoom);
  }, [pendingRoom]);

  async function handleGoogleSignIn() {
    setError(null);
    try {
      const redirectPath = pendingRoom ? `/room/${pendingRoom}` : '/';
      await signInWithGoogle(redirectPath);
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    }
  }

  async function handleCreate() {
    if (!isSignedIn || !userId) {
      setError('Sign in with Google first');
      return;
    }
    if (!name.trim()) {
      setError('Enter a display name');
      return;
    }
    if (!supabaseReady) {
      setError('Supabase is not configured. Check your .env file.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const roomId = generateRoomId();
      await createRoom(roomId, userId);
      await joinRoomUser(roomId, userId, name.trim());
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!isSignedIn || !userId) {
      setError('Sign in with Google first');
      return;
    }
    if (!name.trim()) {
      setError('Enter a display name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Enter a room code');
      return;
    }
    if (!supabaseReady) {
      setError('Supabase is not configured. Check your .env file.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const roomId = joinCode.trim().toUpperCase();
      const exists = await roomExists(roomId);
      if (!exists) {
        setError('Room not found. Check the code and try again.');
        return;
      }

      await joinRoomUser(roomId, userId, name.trim());
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-page">
      <div className="landing-page__backdrop" aria-hidden>
        <div className="landing-page__poster-grid">
          {HERO_POSTERS.map((path, i) => (
            <img
              key={path}
              className="landing-page__poster"
              src={`${POSTER_BASE}${path}`}
              alt=""
              loading={i < 4 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
        <div className="landing-page__overlay" />
      </div>

      <nav className="landing-nav">
        <div className="landing-nav__brand">
          <IconFilm className="landing-nav__logo-icon" />
          <span>Swivio</span>
        </div>
        <div className="landing-nav__right">
          {supabaseReady && (
            <div className="landing-nav__status">
              <span className={`landing-pill ${isTmdbConfigured() ? 'landing-pill--ok' : ''}`}>
                TMDB {isTmdbConfigured() ? '✓' : 'mock'}
              </span>
              <span className={`landing-pill ${isAiConfigured() ? 'landing-pill--ok' : ''}`}>
                AI {isAiConfigured() ? '✓' : 'off'}
              </span>
            </div>
          )}
          {isSignedIn && (
            <div className="user-chip">
              {avatarUrl && <img className="user-chip__avatar" src={avatarUrl} alt="" />}
              <span className="user-chip__name">{displayName}</span>
              <button type="button" className="user-chip__signout" onClick={() => signOut()}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      <header className="landing-hero">
        <p className="landing-hero__eyebrow">Movie night, simplified</p>
        <h1 className="landing-hero__title">
          Swipe together.
          <br />
          <span className="landing-hero__title-accent">Pick tonight&apos;s film.</span>
        </h1>
        <p className="landing-hero__subtitle">
          Create a room, invite friends, and swipe through films until your group finds
          the one. Real reviews, streaming info, and AI picks included.
        </p>

        <div className="landing-features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="landing-feature">
              <div className="landing-feature__icon-wrap">
                <Icon className="landing-feature__icon" />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </header>

      <section className="landing-cta">
        {!supabaseReady && (
          <div className="alert alert--warn">
            Supabase env vars missing. Copy <code>.env.example</code> to <code>.env</code> and fill in your config.
          </div>
        )}

        <div className="landing-cta__card">
          {authLoading ? (
            <div className="auth-gate auth-gate--inline">
              <div className="auth-gate__spinner" aria-hidden />
              <p>Loading…</p>
            </div>
          ) : !isSignedIn ? (
            <>
              <div className="landing-cta__card-header">
                <h2>Sign in to join</h2>
                <p>
                  {pendingRoom
                    ? `Sign in with Google to enter room ${pendingRoom}.`
                    : 'Only signed-in users can create or join swipe rooms.'}
                </p>
              </div>
              <GoogleSignInButton onClick={handleGoogleSignIn} disabled={!supabaseReady} />
              {error && <p className="alert alert--error">{error}</p>}
            </>
          ) : (
            <>
              <div className="landing-cta__card-header">
                <h2>Start swiping</h2>
                <p>Signed in as {displayName}</p>
              </div>

              <label className="field">
                <span className="field__label">Display name in room</span>
                <input
                  className="field__input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                />
              </label>

              <button
                type="button"
                className="btn btn--primary btn--block btn--lg"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? 'Creating…' : 'Create Swipe Room'}
              </button>

              <div className="landing__divider">
                <span>or join a room</span>
              </div>

              <form onSubmit={handleJoin}>
                <label className="field">
                  <span className="field__label">Room code</span>
                  <input
                    className="field__input field__input--code"
                    type="text"
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn--secondary btn--block"
                  disabled={loading}
                >
                  Join Room
                </button>
              </form>

              {error && <p className="alert alert--error">{error}</p>}
            </>
          )}
        </div>
      </section>

      <footer className="landing-footer">
        <p>Built for friends who can never agree on a movie 🍿</p>
      </footer>
    </div>
  );
}
