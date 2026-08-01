import { supabase } from './supabase.js';

/** Display name from Google profile metadata */
export function displayNameFromUser(user) {
  if (!user) return '';
  return (
    user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.email?.split('@')[0]
    || 'User'
  );
}

export function avatarFromUser(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
}

export async function signInWithGoogle(redirectPath = '/') {
  if (!supabase) throw new Error('Supabase is not configured');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${redirectPath}`,
    },
  });

  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
