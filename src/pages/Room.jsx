import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  isSupabaseConfigured,
  subscribeUsers,
  subscribeMovies,
  subscribeVotes,
  subscribeRoom,
  castVote,
  refreshRoomMoviesFromGroup,
  appendRecommendedMovie,
  joinRoomUser,
} from '../lib/supabase.js';
import { getDisplayName } from '../lib/storage.js';
import { useAuth } from '../context/AuthContext.jsx';
import { rankMatches, getGroupGenreNames } from '../lib/scoring.js';
import SwipeDeck from '../components/SwipeDeck.jsx';
import GenrePicker from '../components/GenrePicker.jsx';
import Tabs from '../components/Tabs.jsx';
import MatchesList from '../components/MatchesList.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import PeopleList from '../components/PeopleList.jsx';
import AiPanel from '../components/AiPanel.jsx';
import { IconArrowLeft, IconShare } from '../components/Icons.jsx';

export default function Room() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { userId, displayName: authDisplayName, avatarUrl } = useAuth();
  const displayName = authDisplayName || getDisplayName();

  const [users, setUsers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [votes, setVotes] = useState([]);
  const [hostUserId, setHostUserId] = useState(null);
  const [tab, setTab] = useState('swipe');
  const [connected, setConnected] = useState(true);
  const [movieReasons, setMovieReasons] = useState({});
  const [copied, setCopied] = useState(false);
  const [genresReady, setGenresReady] = useState(false);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState(null);
  const lastGenreKeyRef = useRef('');
  const refreshingRef = useRef(false);
  const [queueHead, setQueueHead] = useState(null);
  const [fetchingNext, setFetchingNext] = useState(false);

  const currentUser = users.find((u) => u.id === userId);
  const hasGenres = (currentUser?.favoriteGenres?.length ?? 0) > 0;
  const groupGenreNames = useMemo(() => getGroupGenreNames(users), [users]);
  const groupGenreKey = useMemo(
    () => [...groupGenreNames].sort().join(','),
    [groupGenreNames]
  );

  const matches = useMemo(() => rankMatches(movies, votes), [movies, votes]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      navigate('/');
      return;
    }

    const unsubs = [
      subscribeUsers(roomId, setUsers),
      subscribeMovies(roomId, setMovies),
      subscribeVotes(roomId, setVotes),
      subscribeRoom(
        roomId,
        (room) => {
          if (!room) {
            navigate('/');
            return;
          }
          setHostUserId(room.hostUserId);
          setConnected(true);
        },
        () => setConnected(false)
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [roomId, navigate]);

  // Auto-join after Google OAuth redirect (upsert is idempotent)
  useEffect(() => {
    if (!userId || !displayName?.trim()) return;
    joinRoomUser(roomId, userId, displayName.trim()).catch(console.error);
  }, [roomId, userId, displayName]);

  useEffect(() => {
    if (hasGenres) setGenresReady(true);
  }, [hasGenres]);

  const loadDeck = useCallback(
    async (force = false, fallbackGenres = []) => {
      if (!hasGenres && fallbackGenres.length === 0) return;
      const key =
        fallbackGenres.length > 0
          ? [...fallbackGenres].sort().join(',')
          : groupGenreKey;
      if (!key) return;
      if (!force && key === lastGenreKeyRef.current) return;
      if (refreshingRef.current) return;

      refreshingRef.current = true;
      setDeckLoading(true);
      setDeckError(null);

      try {
        const { movies: loaded, genreNames } = await refreshRoomMoviesFromGroup(
          roomId,
          fallbackGenres
        );
        const loadedKey = [...genreNames].sort().join(',');

        if (!loaded?.length) {
          setDeckError('No movies found for these genres. Try different picks.');
          return;
        }

        lastGenreKeyRef.current = loadedKey;
      } catch (err) {
        setDeckError(err.message || 'Failed to load movies');
      } finally {
        refreshingRef.current = false;
        setDeckLoading(false);
      }
    },
    [roomId, groupGenreKey, hasGenres]
  );

  // Reload deck when someone new picks genres
  useEffect(() => {
    if (hasGenres && groupGenreKey !== lastGenreKeyRef.current) {
      loadDeck();
    }
  }, [groupGenreKey, hasGenres, loadDeck]);

  const handleVote = useCallback(
    async (movieId, vote) => {
      await castVote(roomId, userId, movieId, vote);
      setQueueHead(null);
      setFetchingNext(true);
      try {
        const next = await appendRecommendedMovie(roomId, movieId, vote);
        if (next) setQueueHead({ ...next, aiRecommended: true });
      } catch (err) {
        console.error('Failed to fetch next recommendation:', err);
      } finally {
        setFetchingNext(false);
      }
    },
    [roomId, userId]
  );

  const handleGenresComplete = useCallback(
    async (myGenres) => {
      setGenresReady(true);
      await loadDeck(true, myGenres);
    },
    [loadDeck]
  );

  const copyLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabs = [
    { id: 'swipe', label: 'Swipe' },
    { id: 'matches', label: 'Matches', badge: matches.filter((m) => m.score >= 60).length || null },
    { id: 'compat', label: 'Compat' },
    { id: 'people', label: 'People', badge: users.length || null },
  ];

  const showGenrePicker = tab === 'swipe' && !genresReady && !hasGenres;

  return (
    <div className="room">
      <header className="room__header">
        <Link to="/" className="room__back" aria-label="Back home">
          <IconArrowLeft />
        </Link>
        <div className="room__title">
          <h1>Room {roomId}</h1>
          {!connected && <span className="badge badge--warn">Reconnecting…</span>}
        </div>
        <button type="button" className="btn btn--ghost btn--sm room__share" onClick={copyLink}>
          <IconShare className="room__share-icon" />
          {copied ? 'Copied!' : 'Share'}
        </button>
        {avatarUrl && (
          <img className="room__avatar" src={avatarUrl} alt="" title={displayName} />
        )}
      </header>

      <div className="room__code">
        <span>Code: <strong>{roomId}</strong></span>
        <span className="room__votes">{votes.length} votes</span>
      </div>

      <aside className="room__sidebar">
        <h3>In the room</h3>
        <PeopleList users={users} hostUserId={hostUserId} currentUserId={userId} />
      </aside>

      <main className="room__main">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {!showGenrePicker && (
          <AiPanel
            roomId={roomId}
            movies={movies}
            votes={votes}
            users={users}
            onReasonsReady={setMovieReasons}
          />
        )}

        {tab === 'swipe' && showGenrePicker && (
          <GenrePicker
            roomId={roomId}
            userId={userId}
            displayName={displayName}
            onComplete={handleGenresComplete}
          />
        )}

        {tab === 'swipe' && !showGenrePicker && (
          deckLoading || movies.length === 0 ? (
            <div className="empty-state">
              <p>{deckLoading ? 'Building your group\'s deck…' : 'Loading movies…'}</p>
              {groupGenreNames.length > 0 && (
                <p className="genre-picker__count">
                  Matching: {groupGenreNames.join(', ')}
                </p>
              )}
              {deckError && <p className="alert alert--error">{deckError}</p>}
            </div>
          ) : (
            <SwipeDeck
              movies={movies}
              votes={votes}
              userId={userId}
              onVote={handleVote}
              queueHead={queueHead}
              fetchingNext={fetchingNext}
            />
          )
        )}

        {tab === 'matches' && (
          <MatchesList matches={matches} movieReasons={movieReasons} />
        )}

        {tab === 'compat' && (
          <Scoreboard
            users={users}
            votes={votes}
            hostUserId={hostUserId}
            currentUserId={userId}
          />
        )}

        {tab === 'people' && (
          <PeopleList users={users} hostUserId={hostUserId} currentUserId={userId} />
        )}
      </main>
    </div>
  );
}
