import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  message?: string;
  needsEmailConfirmation?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (name: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadProfileName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data?.name ?? null;
}

function mapAuthUser(rawUser: { id: string; email?: string | null }, profileName: string | null): AuthUser {
  const email = rawUser.email ?? "";
  return {
    id: rawUser.id,
    email,
    name: profileName || email || "FocusOS User"
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const syncCurrentSession = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;

      if (!active) {
        return;
      }

      if (!sessionUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const profileName = await loadProfileName(sessionUser.id);
      if (!active) {
        return;
      }

      setUser(mapAuthUser(sessionUser, profileName));
      setLoading(false);
    };

    void syncCurrentSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      if (!sessionUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      void loadProfileName(sessionUser.id).then((profileName) => {
        setUser(mapAuthUser(sessionUser, profileName));
        setLoading(false);
      });
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const signup = async (name: string, email: string, password: string): Promise<AuthResult> => {
    const emailRedirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/auth`
      : undefined;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo }
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    const userId = data.user?.id;
    if (userId) {
      await supabase.from("profiles").upsert(
        {
          id: userId,
          name,
          timezone: "America/New_York",
          week_start_day: 1
        },
        { onConflict: "id" }
      );
    }

    if (!data.session && data.user) {
      return {
        ok: true,
        needsEmailConfirmation: true,
        message: "Check your inbox to confirm your email, then sign in."
      };
    }

    return { ok: true };
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
