import { useState, useEffect, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from './AuthContext';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[AUTH] Attempting sign in for:', email);

    // Check if account is locked before attempting login
    try {
      const { data: isLocked, error: lockError } = await supabase.rpc('is_account_locked', {
        user_email: email
      });

      if (lockError) {
        console.warn('[AUTH] Lock check failed (non-critical):', lockError.message);
        // Continue with login even if lock check fails
      } else if (isLocked) {
        console.error('[AUTH] Account is locked');
        return { error: { message: 'Account temporarily locked due to security concerns. Please try again later.' } };
      }
    } catch (lockCheckError) {
      console.warn('[AUTH] Could not check account lock status:', lockCheckError);
      // Continue with login even if lock check fails
    }

    console.log('[AUTH] Calling signInWithPassword...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('[AUTH] Sign in failed:', error.message, error);

      // Record failed login attempt
      try {
        await supabase.rpc('record_failed_login', {
          user_email: email,
          client_ip: null,
          client_user_agent: navigator.userAgent
        });
      } catch (recordError) {
        console.warn('[AUTH] Could not record failed login:', recordError);
      }
    } else {
      console.log('[AUTH] Sign in successful, user:', data.user?.email);
    }

    return { error };
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata
      }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};
