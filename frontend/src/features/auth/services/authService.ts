import { supabase } from '../../../config/supabaseClient';
import { SignInWithPasswordCredentials, SignUpWithPasswordCredentials } from '@supabase/supabase-js';

// Define a common interface for email/password credentials
export interface EmailPasswordCredentials {
  email: string;
  password: string;
}

// Define the Profile type based on your DB schema
export interface Profile {
  id: string; // Corresponds to auth.users.id
  updated_at?: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  website?: string | null;
}

export const signInWithEmailPassword = async (credentials: EmailPasswordCredentials) => {
  // Supabase's signInWithPassword takes an object that matches SignInWithPasswordCredentials
  const signInCredentials: SignInWithPasswordCredentials = { 
    email: credentials.email,
    password: credentials.password 
  };
  return supabase.auth.signInWithPassword(signInCredentials);
};

export const signUpWithEmailPassword = async (credentials: EmailPasswordCredentials) => {
  // Supabase's signUp takes an object that matches SignUpWithPasswordCredentials
  // We can add options like 'data' or 'emailRedirectTo' later if needed
  const signUpCredentials: SignUpWithPasswordCredentials = {
    email: credentials.email,
    password: credentials.password,
    // options: { data: { full_name: 'Optional User Name' } } // Example of adding extra data
  };
  return supabase.auth.signUp(signUpCredentials);
};

// --- Password Reset Functions ---

/**
 * Sends a password reset email to the user.
 * @param email The user's email address.
 */
export const requestPasswordResetForEmail = async (email: string): Promise<{ data: any; error: Error | null }> => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    // redirectTo: `${window.location.origin}/reset-password` // Ensure this matches your reset password page route
  });
  if (error) {
    console.error('Error requesting password reset:', error);
  }
  return { data, error };
};

/**
 * Updates the user's password. This is typically used on the reset password page.
 * Requires the user to be authenticated via the reset token (handled by Supabase on navigation from email link).
 * @param newPassword The new password.
 */
export async function updateUserPassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error('Error updating user password:', error);
    throw error;
  }
  return data;
}

/**
 * Updates the user's password. This is typically used on the reset password page.
 * Requires the user to be authenticated via the reset token (handled by Supabase on navigation from email link).
 * @param newPassword The new password.
 */
export const updateUserPasswordOld = async (newPassword: string): Promise<{ data: any; error: Error | null }> => {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error('Error updating user password:', error);
  }
  return { data, error };
};

// --- Profile Management Functions ---

/**
 * Fetches the profile for the currently authenticated user.
 * Assumes the user is already authenticated and their ID can be retrieved.
 */


export const getProfile = async (): Promise<{ profile: Profile | null; error: Error | null }> => {
  console.log('[authService getProfile] Attempting to get user.'); // ADDED
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[authService getProfile] supabase.auth.getUser() returned.', { user, userError }); // ADDED

  if (userError || !user) {
    console.error('[authService getProfile] Error fetching user or no user:', userError); // MODIFIED to be more specific
    return { profile: null, error: userError };
  }

  console.log(`[authService getProfile] User found (ID: ${user.id}). Attempting to fetch profile from DB.`); // ADDED
  console.log('[authService getProfile] About to query user_profiles table in duckcode schema');
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  console.log('[authService getProfile] supabase.from(\'user_profiles\').select() returned.', { data, error }); // ADDED

  if (error && error.code !== 'PGRST116') { // PGRST116: 'single' row not found (expected if no profile)
    console.error('[authService getProfile] Error fetching profile from DB:', error); // MODIFIED
  }
  
  const profileResult = data as Profile | null;
  const finalError = error && error.code !== 'PGRST116' ? error : null;
  console.log('[authService getProfile] Returning:', { profileResult, finalError }); // ADDED
  return { profile: profileResult, error: finalError };
};

/**
 * Creates or updates a user's profile.
 * The 'id' field in profileData must match the authenticated user's ID.
 */
export const upsertProfile = async (profileData: Partial<Profile>): Promise<{ profile: Profile | null; error: Error | null }> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user for upserting profile:', userError);
    return { profile: null, error: userError };
  }

  // Ensure the profile ID matches the authenticated user's ID
  const dataToUpsert = {
    ...profileData,
    id: user.id, // Enforce that the id is the current user's id
    updated_at: new Date().toISOString(), // Manually set updated_at as per RLS/trigger setup
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(dataToUpsert)
    .select()
    .single();

  if (error) {
    console.error('Error upserting profile:', error);
  }

  return { profile: data as Profile | null, error };
};

export async function signInWithGitHub(redirectTo?: string) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: redirectTo || window.location.origin + '/login'
    }
  });
  if (error) {
    console.error('Error signing in with GitHub:', error);
    throw error;
  }
}

// GitHub and SSO functions will be added here later
