/** Format large counts for badges (e.g. 12400 → "12.4k") */
export function formatCount(n) {
  if (n == null || n === 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}
