/** Vote values stored in Supabase */
export const VOTE = {
  DISLIKE: -1,
  LIKE: 1,
  WATCHED_DISLIKED: -2,
  WATCHED_ENJOYED: 2,
};

export const VOTE_LABELS = {
  [VOTE.DISLIKE]: 'Dislike',
  [VOTE.LIKE]: 'Like',
  [VOTE.WATCHED_DISLIKED]: 'Watched & Disliked',
  [VOTE.WATCHED_ENJOYED]: 'Watched & Enjoyed',
};

export function isPositiveVote(vote) {
  return vote > 0;
}

export function isNegativeVote(vote) {
  return vote < 0;
}

export function voteOverlay(vote) {
  if (vote === VOTE.LIKE) return 'like';
  if (vote === VOTE.DISLIKE) return 'nope';
  if (vote === VOTE.WATCHED_ENJOYED) return 'seen-like';
  if (vote === VOTE.WATCHED_DISLIKED) return 'seen-nope';
  return null;
}

export function overlayText(overlay) {
  const map = {
    like: 'LIKE',
    nope: 'NOPE',
    'seen-like': 'SEEN ♥',
    'seen-nope': 'SEEN ✕',
  };
  return map[overlay] ?? '';
}
