import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  leaveRoomUser,
  setUserReady,
  startRoomFromLobby,
  setRoomStatus,
  ROOM_STATUS,
} from '../lib/supabase.js';
import { getDisplayName } from '../lib/storage.js';
import { useAuth } from '../context/AuthContext.jsx';
import { rankMatches, getGroupGenreNames } from '../lib/scoring.js';
import { getActiveRound, getRoundAppointer, getLastVoteForMovie } from '../lib/round.js';
import { upsertUserProfile } from '../lib/daily.js';
import { allUsersPickedGenres } from '../lib/lobby.js';
import SwipeDeck from '../components/SwipeDeck.jsx';
import GenrePicker from '../components/GenrePicker.jsx';
import Lobby from '../components/Lobby.jsx';
import MatchesList from '../components/MatchesList.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import PeopleList from '../components/PeopleList.jsx';
import AiPanel from '../components/AiPanel.jsx';
import Navbar from '../components/Navbar.jsx';
import GroupChat from '../components/GroupChat.jsx';
import DailyPickPanel from '../components/DailyPickPanel.jsx';

export default function Room() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { userId, displayName: authDisplayName, avatarUrl } = useAuth();
  const displayName = authDisplayName || getDisplayName();

  const [users, setUsers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [votes, setVotes] = useState([]);
  const [hostUserId, setHostUserId] = useState(null);
  const [roomStatus, setRoomStatusState] = useState(ROOM_STATUS.LOBBY);
  const [tab, setTab] = useState('swipe');
  const [connected, setConnected] = useState(true);
  const [joinError, setJoinError] = useState(null);
  const [movieReasons, setMovieReasons] = useState({});
  const [copied, setCopied] = useState(false);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState(null);
  const [starting, setStarting] = useState(false);
  const lastGenreKeyRef = useRef('');
  const refreshingRef = useRef(false);
  const [fetchingNext, setFetchingNext] = useState(false);
  const appendLockRef = useRef(false);
  const joinedRef = useRef(false);

  const currentUser = users.find((u) => u.id === userId);
  const hasGenres = (currentUser?.favoriteGenres?.length ?? 0) > 0;
  const isReady = currentUser?.isReady ?? false;
  const everyonePickedGenres = allUsersPickedGenres(users);
  const groupGenreNames = useMemo(() => getGroupGenreNames(users), [users]);
  const groupGenreKey = useMemo(
    () => [...groupGenreNames].sort().join(','),
    [groupGenreNames]
  );

  const matches = useMemo(
    () => rankMatches(movies, votes, users.length),
    [movies, votes, users.length]
  );

  const activeRound = useMemo(
    () => getActiveRound(movies, votes, users),
    [movies, votes, users]
  );

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
          setRoomStatusState(room.status);
          setConnected(true);
        },
        () => setConnected(false)
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [roomId, navigate]);

  useEffect(() => {
    if (!userId || !displayName?.trim()) return;

    joinedRef.current = true;
    joinRoomUser(roomId, userId, displayName.trim(), avatarUrl)
      .then(() => upsertUserProfile(userId, { displayName, avatarUrl }))
      .catch((err) => {
        setJoinError(err.message);
        if (err.message.includes("can't join")) {
          setTimeout(() => navigate('/'), 2500);
        }
      });

    return () => {
      if (joinedRef.current) {
        leaveRoomUser(roomId, userId).catch(() => {});
        joinedRef.current = false;
      }
    };
  }, [roomId, userId, displayName, avatarUrl, navigate]);

  const loadDeck = useCallback(
    async (force = false) => {
      const key = groupGenreKey;
      if (!key) return;
      if (!force && key === lastGenreKeyRef.current) return;
      if (refreshingRef.current) return;

      refreshingRef.current = true;
      setDeckLoading(true);
      setDeckError(null);

      try {
        const { movies: loaded, genreNames } = await refreshRoomMoviesFromGroup(roomId);
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
    [roomId, groupGenreKey]
  );

  // Host builds deck once everyone picked genres, then opens swiping
  useEffect(() => {
    if (roomStatus !== ROOM_STATUS.GENRES || !everyonePickedGenres) return;
    if (users.length === 0 || refreshingRef.current) return;
    if (userId !== hostUserId) return;

    (async () => {
      await loadDeck(true);
      await setRoomStatus(roomId, ROOM_STATUS.SWIPING);
    })().catch(console.error);
  }, [roomStatus, everyonePickedGenres, users, userId, hostUserId, roomId, loadDeck]);

  const handleVote = useCallback(
    async (movieId, vote) => {
      await castVote(roomId, userId, movieId, vote);
    },
    [roomId, userId]
  );

  useEffect(() => {
    if (roomStatus !== ROOM_STATUS.SWIPING) return;
    if (!activeRound?.needsNext || !activeRound.lastMovie) return;
    if (users.length === 0 || appendLockRef.current) return;

    const appointer = getRoundAppointer(users);
    if (userId !== appointer) return;

    appendLockRef.current = true;
    setFetchingNext(true);

    const lastMovie = activeRound.lastMovie;
    const lastVote = getLastVoteForMovie(votes, lastMovie.id) ?? 1;

    appendRecommendedMovie(roomId, lastMovie.id, lastVote)
      .catch((err) => console.error('Failed to fetch next recommendation:', err))
      .finally(() => {
        appendLockRef.current = false;
        setFetchingNext(false);
      });
  }, [activeRound, users, userId, roomId, votes, roomStatus]);

  const handleToggleReady = useCallback(async () => {
    await setUserReady(roomId, userId, !isReady, displayName, avatarUrl);
  }, [roomId, userId, isReady, displayName, avatarUrl]);

  const handleStartLobby = useCallback(async () => {
    setStarting(true);
    try {
      await startRoomFromLobby(roomId, userId);
    } finally {
      setStarting(false);
    }
  }, [roomId, userId]);

  const handleLeave = useCallback(async () => {
    await leaveRoomUser(roomId, userId);
    navigate('/');
  }, [roomId, userId, navigate]);

  const copyLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabs = [
    { id: 'swipe', label: 'Swipe' },
    { id: 'daily', label: 'Daily' },
    { id: 'chat', label: 'Chat' },
    { id: 'matches', label: 'Matches', badge: matches.filter((m) => m.score >= 60).length || null },
    { id: 'compat', label: 'Compat' },
    { id: 'people', label: 'People', badge: users.length || null },
  ];

  const inLobby = roomStatus === ROOM_STATUS.LOBBY;
  const inGenres = roomStatus === ROOM_STATUS.GENRES;
  const inSwiping = roomStatus === ROOM_STATUS.SWIPING;

  return (
    <div className="room">
      <Navbar
        variant="room"
        roomId={roomId}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        onShare={inLobby ? copyLink : copyLink}
        copied={copied}
        avatarUrl={avatarUrl}
        displayName={displayName}
        connected={connected}
      />

      <div className="room__code">
        <span>{users.length} in room{inLobby ? ' · Lobby open' : ' · Session started'}</span>
        <button type="button" className="room__leave" onClick={handleLeave}>
          Leave room
        </button>
      </div>

      {joinError && (
        <div className="room__banner alert alert--error">{joinError}</div>
      )}

      <aside className="room__sidebar">
        <h3>In the room</h3>
        <PeopleList
          users={users}
          hostUserId={hostUserId}
          currentUserId={userId}
          showReady={inLobby}
        />
      </aside>

      <main className="room__main">
        {inSwiping && (
          <AiPanel
            roomId={roomId}
            roomStatus={roomStatus}
            movies={movies}
            votes={votes}
            users={users}
            onReasonsReady={setMovieReasons}
          />
        )}

        {tab === 'swipe' && inLobby && (
          <Lobby
            users={users}
            hostUserId={hostUserId}
            currentUserId={userId}
            isReady={isReady}
            onToggleReady={handleToggleReady}
            onStart={handleStartLobby}
            starting={starting}
          />
        )}

        {tab === 'swipe' && inGenres && !hasGenres && (
          <GenrePicker
            roomId={roomId}
            userId={userId}
            displayName={displayName}
            avatarUrl={avatarUrl}
            onComplete={() => {}}
          />
        )}

        {tab === 'swipe' && inGenres && hasGenres && !everyonePickedGenres && (
          <div className="empty-state">
            <span className="empty-state__icon">🎭</span>
            <h3>Waiting for everyone&apos;s genres</h3>
            <p>
              Still waiting:{' '}
              {users.filter((u) => !(u.favoriteGenres?.length > 0)).map((u) => u.displayName).join(', ') || 'others'}
            </p>
          </div>
        )}

        {tab === 'swipe' && inGenres && everyonePickedGenres && (
          <div className="empty-state">
            <p>{deckLoading ? 'Building your group\'s deck…' : 'Starting swipe session…'}</p>
            {deckError && <p className="alert alert--error">{deckError}</p>}
          </div>
        )}

        {tab === 'swipe' && inSwiping && (
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
              users={users}
              userId={userId}
              onVote={handleVote}
              fetchingNext={fetchingNext}
            />
          )
        )}

        {tab === 'daily' && (
          <DailyPickPanel
            roomId={roomId}
            users={users}
            userId={userId}
            hostUserId={hostUserId}
          />
        )}

        {tab === 'chat' && (
          <GroupChat
            roomId={roomId}
            userId={userId}
            displayName={displayName}
            avatarUrl={avatarUrl}
          />
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
          <PeopleList
            users={users}
            hostUserId={hostUserId}
            currentUserId={userId}
            showReady={inLobby}
          />
        )}
      </main>
    </div>
  );
}
