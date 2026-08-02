/** PostgREST / Postgres errors when tables or columns are missing from the DB */

export function isMissingTableError(error) {
  if (!error) return false;
  const code = error.code ?? error?.status;
  if (code === 'PGRST205' || code === 404 || code === '42P01') return true;
  const msg = String(error.message ?? error);
  return (
    msg.includes('schema cache') ||
    msg.includes('user_profiles') ||
    msg.includes('user_swipes') ||
    msg.includes('room_messages') ||
    msg.includes('room_daily_picks')
  );
}

export function isMissingColumnError(error) {
  if (!error) return false;
  const code = error.code ?? error?.status;
  if (code === 'PGRST204' || code === '42703') return true;
  const msg = String(error.message ?? error);
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('Could not find'));
}

export function isSchemaMismatchError(error) {
  return isMissingTableError(error) || isMissingColumnError(error);
}
