import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Rate limiting: track failed sign-in attempts per email
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  lastAttempt: number;
}

const failedAttempts = new Map<string, AttemptRecord>();

function isRateLimited(email: string): { blocked: boolean; remainingMinutes: number } {
  const record = failedAttempts.get(email.toLowerCase());
  if (!record || record.count < MAX_ATTEMPTS) {
    return { blocked: false, remainingMinutes: 0 };
  }
  const elapsed = Date.now() - record.lastAttempt;
  if (elapsed >= LOCKOUT_DURATION_MS) {
    failedAttempts.delete(email.toLowerCase());
    return { blocked: false, remainingMinutes: 0 };
  }
  const remainingMinutes = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 60000);
  return { blocked: true, remainingMinutes };
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase();
  const record = failedAttempts.get(key);
  if (record) {
    // Reset if lockout period has passed
    const elapsed = Date.now() - record.lastAttempt;
    if (elapsed >= LOCKOUT_DURATION_MS) {
      failedAttempts.set(key, { count: 1, lastAttempt: Date.now() });
    } else {
      failedAttempts.set(key, { count: record.count + 1, lastAttempt: Date.now() });
    }
  } else {
    failedAttempts.set(key, { count: 1, lastAttempt: Date.now() });
  }
}

function clearFailedAttempts(email: string): void {
  failedAttempts.delete(email.toLowerCase());
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { blocked, remainingMinutes } = isRateLimited(email);
    if (blocked) {
      return {
        error: new Error(
          `Muitas tentativas de login. Tente novamente em ${remainingMinutes} minuto${remainingMinutes !== 1 ? "s" : ""}.`
        ),
      };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      recordFailedAttempt(email);
      const record = failedAttempts.get(email.toLowerCase());
      const attemptsLeft = record ? MAX_ATTEMPTS - record.count : MAX_ATTEMPTS;
      if (attemptsLeft > 0) {
        return {
          error: new Error(
            `${error.message} (${attemptsLeft} tentativa${attemptsLeft !== 1 ? "s" : ""} restante${attemptsLeft !== 1 ? "s" : ""})`
          ),
        };
      }
      return {
        error: new Error(
          "Conta bloqueada temporariamente. Tente novamente em 15 minutos."
        ),
      };
    }

    clearFailedAttempts(email);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
