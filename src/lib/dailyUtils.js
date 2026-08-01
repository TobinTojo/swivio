/** Calendar date string for daily features (local timezone) */
export function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DAILY_SWIPE_LIMIT = 5;

export function dailySwipeProgress(count) {
  return Math.min(count, DAILY_SWIPE_LIMIT);
}

export function allMembersVotedDaily(votes, userIds) {
  if (userIds.length === 0) return false;
  const voters = new Set(votes.map((v) => v.userId));
  return userIds.every((id) => voters.has(id));
}

export function dailyPickResult(votes, userIds) {
  if (!allMembersVotedDaily(votes, userIds)) return null;
  const likes = votes.filter((v) => v.vote > 0).length;
  const dislikes = votes.filter((v) => v.vote < 0).length;
  const approved = likes >= dislikes;
  return { likes, dislikes, total: userIds.length, approved };
}
