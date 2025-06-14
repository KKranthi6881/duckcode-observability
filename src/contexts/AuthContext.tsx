import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient'; // We created this earlier

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ data: any; error: any }>;
  register: (email: string, pass: string) => Promise<{ data: any; error: any }>;
  logout: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  // Placeholder functions - to be implemented
  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pass,
    });
    setIsLoading(false);
    return { data, error };
  };

  const register = async (email: string, pass: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: pass,
      // Supabase will send a confirmation email by default if enabled in your project settings
    });
    setIsLoading(false);
    return { data, error };
  };

  const logout = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    // Session and user state will be updated automatically by onAuthStateChange
    setIsLoading(false);
    if (error) {
      console.error('Error logging out:', error.message);
    }
    return { error };
  };

  const value = {
    session,
    user,
    isLoading,
    login,
    register,
    logout,
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
