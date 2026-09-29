import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  organization: string | null;
  account_type: "investor" | "mining_owner" | "geocapitals_team" | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id,user_id,display_name,email,avatar_url,organization,account_type")
      .eq("user_id", uid)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  };

  useEffect(() => {
    let initialResolved = false;

    // `supabase` es un Proxy perezoso: tocar `.auth` recién acá crea el
    // cliente real y, si faltan las env vars, tira. Sin este try/catch ese
    // throw ocurre dentro de un efecto — React lo trata como error no
    // controlado y tumba TODA la app (incluidas rutas públicas que no
    // necesitan auth), porque AuthProvider envuelve toda la app en
    // __root.tsx. Con env vars faltantes, degradamos a "sin sesión" en vez
    // de romper el render.
    try {
      // Set up listener FIRST
      const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // defer profile load to avoid recursive lock
          setTimeout(() => loadProfile(newSession.user.id), 0);
        } else {
          setProfile(null);
        }
        // Only flip loading off after the initial getSession() has resolved.
        // This prevents a transient "no user" state during first render that
        // would cause protected routes to bounce to /auth.
        if (initialResolved) setLoading(false);
      });

      supabase.auth
        .getSession()
        .then(({ data: { session: s } }) => {
          initialResolved = true;
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user) loadProfile(s.user.id);
          setLoading(false);
        })
        .catch((err) => {
          console.error("[AuthProvider] getSession falló:", err);
          setLoading(false);
        });

      return () => sub.subscription.unsubscribe();
    } catch (err) {
      console.error(
        "[AuthProvider] No se pudo inicializar el cliente de Supabase (¿faltan env vars?):",
        err,
      );
      setLoading(false);
      return undefined;
    }
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
