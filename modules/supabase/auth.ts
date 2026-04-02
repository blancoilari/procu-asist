/**
 * Supabase Auth module for the Chrome extension.
 * Handles OAuth sign-in/out and session management.
 */

import { getSupabaseClient } from './client';

export type AuthProvider = 'google' | 'azure' | 'linkedin_oidc';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Sign in with OAuth provider.
 * Opens a new tab for the OAuth flow, then returns the session.
 */
export async function signInWithOAuth(provider: AuthProvider): Promise<void> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // Chrome extension needs to redirect back to the extension
      redirectTo: chrome.identity.getRedirectURL(),
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  // Use chrome.identity.launchWebAuthFlow for extension OAuth
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: data.url,
    interactive: true,
  });

  if (!responseUrl) throw new Error('OAuth flow cancelled');

  // Extract tokens from the callback URL
  const url = new URL(responseUrl);
  const hashParams = new URLSearchParams(url.hash.substring(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }
}

/** Sign out */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}

/** Get current user profile (null if not signed in) */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profile info
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? '',
    displayName:
      profile?.display_name ?? user.user_metadata?.full_name ?? user.email ?? '',
    avatarUrl: profile?.avatar_url ?? user.user_metadata?.avatar_url,
  };
}

/** Check if user is signed in */
export async function isSignedIn(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
}
