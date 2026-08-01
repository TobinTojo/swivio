const USER_ID_KEY = 'swivio_userId';
const DISPLAY_NAME_KEY = 'swivio_displayName';

/** Persistent anonymous user id — no login required */
export function getUserId() {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function getDisplayName() {
  return localStorage.getItem(DISPLAY_NAME_KEY) || '';
}

export function setDisplayName(name) {
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim());
}
