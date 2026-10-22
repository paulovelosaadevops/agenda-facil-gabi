import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Business, Client } from "@shared/types.ts";
import { supabase } from "./supabase";

/** owner = a Gabi (dona do estúdio); client = cliente com conta; none = sem perfil ainda. */
export type Role = "owner" | "client" | "none";

interface AuthState {
  /** true enquanto a sessão salva e o perfil ainda estão sendo lidos. */
  loading: boolean;
  session: Session | null;
  role: Role;
  /** Estúdio (só para a dona). */
  business: Business | null;
  /** Ficha da cliente logada. */
  client: Client | null;
  /** Já existe estúdio configurado? (false só na primeira instalação.) */
  studioExists: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function loadProfile(session: Session | null) {
  const { data: exists } = await supabase.rpc("business_exists");
  if (!session) return { role: "none" as Role, business: null, client: null, studioExists: Boolean(exists) };

  // A RLS só devolve o estúdio para a dona e a ficha para a própria cliente.
  const [{ data: business }, { data: client }] = await Promise.all([
    supabase.from("businesses").select("*").eq("owner_id", session.user.id).limit(1).maybeSingle<Business>(),
    supabase.from("clients").select("*").eq("user_id", session.user.id).maybeSingle<Client>(),
  ]);
  const role: Role = business ? "owner" : client ? "client" : "none";
  return { role, business: business ?? null, client: client ?? null, studioExists: Boolean(exists) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof loadProfile>>>({
    role: "none",
    business: null,
    client: null,
    studioExists: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async (next: Session | null) => {
      const p = await loadProfile(next);
      if (!active) return;
      setSession(next);
      setProfile(p);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Renovar o token não muda o usuário: evita recarregar tudo a cada hora.
      if (event === "TOKEN_REFRESHED") setSession(next);
      else if (event !== "INITIAL_SESSION") load(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    setProfile(await loadProfile(session));
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ loading, session, ...profile, refresh, signOut }),
    [loading, session, profile, refresh, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}

/** Estúdio da dona logada (as telas do painel só existem para ela). */
export function useBusiness(): Business {
  const { business } = useAuth();
  if (!business) throw new Error("Estúdio não carregado");
  return business;
}

/** Ficha da cliente logada (as telas da área da cliente só existem para ela). */
export function useClient(): Client {
  const { client } = useAuth();
  if (!client) throw new Error("Cliente não carregada");
  return client;
}
