import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthValue = {
  session: Session | null;
  userId: string | null;
  /** True until the persisted session has been read back from storage. */
  loading: boolean;
  /** Email a six digit code, creating the account if this is a first visit. */
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Who was signed in last time, remembered by this app rather than read back
 * out of the auth library's storage.
 *
 * Reading the session is asynchronous, and until it resolves the app does not
 * know whether to draw the house or the front door, so it drew neither. That
 * was a frame or more of nothing on every open. Knowing the user id at the
 * first render, together with the cached profile, means the house is the very
 * first thing painted. If the session turns out to be gone, the front door
 * follows a moment later, which is the right order of surprises.
 */
const KNOWN_USER = 'gharbaar-user';

function readKnownUser(): string | null {
  try {
    return window.localStorage.getItem(KNOWN_USER);
  } catch {
    return null;
  }
}

function writeKnownUser(id: string | null) {
  try {
    if (id) window.localStorage.setItem(KNOWN_USER, id);
    else window.localStorage.removeItem(KNOWN_USER);
  } catch {
    // Private mode, or storage full. The next open is slower, nothing worse.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [knownUser, setKnownUser] = useState<string | null>(readKnownUser);
  const [loading, setLoading] = useState(() => readKnownUser() === null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const take = (next: Session | null) => {
      setSession(next);
      setKnownUser(next?.user.id ?? null);
      writeKnownUser(next?.user.id ?? null);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => take(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => take(next));

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      userId: session?.user.id ?? knownUser,
      loading,

      /**
       * No passwords anywhere in this app. Owning the inbox is the proof, which
       * is the one credential six housemates already have and cannot forget.
       */
      sendCode: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
      },

      verifyCode: async (email, code) => {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: code.trim(),
          type: 'email',
        });
        if (error) throw error;
      },

      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // The cached copy of the house goes with the session, so the next
        // person to sign in on this phone does not open on somebody else's
        // view of it.
        queryClient.clear();
      },
    }),
    [session, knownUser, loading, queryClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
