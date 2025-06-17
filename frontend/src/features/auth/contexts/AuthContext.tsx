import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/config/supabaseClient';
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (initialSession?.user) {
          const { profile: userProfile, error: profileError } = await getProfile();
          if (profileError) {
            console.error('Error fetching initial profile:', profileError);
            // Don't throw, maybe the user has no profile yet. Allow login.
          }
          setSession(initialSession);
          setUser(initialSession.user);
          setProfile(userProfile);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (error) { 
        console.error("Error during initial auth check:", error);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Fetch profile, but don't block UI with a loading spinner here
        // The main loading is for the initial app load.
        const { profile: userProfile, error: profileError } = await getProfile();
        if (profileError) {
          console.error('Error fetching profile on auth change:', profileError);
        }
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
    // The onAuthStateChange listener will handle clearing local state.
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
