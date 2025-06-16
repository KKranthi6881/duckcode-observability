import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../../config/supabaseClient'; // Adjusted path
import { getProfile, Profile } from '../services/authService'; // Import Profile and getProfile

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null; // Add profile state
  isLoading: boolean;
  signOut: () => Promise<void>;
  // We could add a refreshProfile function here if needed later
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null); // Initialize profile state
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Check for initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        const { profile: userProfile, error: profileError } = await getProfile();
        if (profileError) {
          console.error('Error fetching initial profile:', profileError);
        }
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setIsLoading(true); // Set loading true while fetching profile
        const { profile: userProfile, error: profileError } = await getProfile();
        if (profileError) {
          console.error('Error fetching profile on auth change:', profileError);
        }
        setProfile(userProfile);
        setIsLoading(false);
      } else {
        setProfile(null); // Clear profile on sign out
        // setIsLoading(false); // Already handled by initial load or if no new session
      }
      // Ensure loading is false if there's no new session after an event (e.g. SIGNED_OUT)
      if (!newSession) {
        setIsLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // State will be cleared by onAuthStateChange listener
    } catch (error) {
      console.error('Error signing out:', error);
      // Optionally set an error state here to show in UI
    } finally {
      // setIsLoading(false); // Listener will set loading state
    }
  };

  const value = {
    session,
    user,
    profile,
    isLoading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
