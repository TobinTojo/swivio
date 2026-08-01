/** Room lifecycle phases */
export const ROOM_STATUS = {
  LOBBY: 'lobby',
  GENRES: 'genres',
  SWIPING: 'swiping',
};

/** Legacy rows used status 'active' — treat as swiping */
export function normalizeRoomStatus(status) {
  if (status === 'active') return ROOM_STATUS.SWIPING;
  return status || ROOM_STATUS.LOBBY;
}

export function canJoinRoom(status) {
  return normalizeRoomStatus(status) === ROOM_STATUS.LOBBY;
}

export function allUsersReady(users) {
  return users.length > 0 && users.every((u) => u.isReady);
}

export function allUsersPickedGenres(users) {
  return users.length > 0 && users.every((u) => (u.favoriteGenres?.length ?? 0) > 0);
}
