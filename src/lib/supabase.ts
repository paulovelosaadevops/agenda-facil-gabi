import { createClient, FunctionsHttpError } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { authStorage } from "./storage";

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!configuredUrl || !key) {
  throw new Error("Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local");
}

/**
 * Em desenvolvimento no celular, "127.0.0.1"/"localhost" é o próprio aparelho, não o computador.
 * Troca pelo IP do computador que está servindo o app (o mesmo que o Expo Go usa para baixar o código).
 */
function resolveDevUrl(raw: string): string {
  if (!__DEV__ || Platform.OS === "web") return raw;
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (!devHost) return raw;
  const parsed = new URL(raw);
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") return raw;
  return raw.replace(parsed.hostname, devHost);
}

const url = resolveDevUrl(configuredUrl);

export const supabase = createClient(url, key, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: Boolean(authStorage),
    detectSessionInUrl: Platform.OS === "web",
  },
});

// No celular, só renova o token com o app em primeiro plano (recomendação do Supabase).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Chama uma Edge Function e devolve o JSON, convertendo erros em mensagens legíveis. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? "Não foi possível concluir. Tente novamente.");
    }
    throw new Error("Sem conexão com o servidor. Verifique sua internet.");
  }
  return data as T;
}

/** Mensagem amigável para erros do banco. */
export function dbErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23P01") return "Esse horário já está ocupado por outro agendamento.";
  if (error.code === "23505") return "Já existe um cadastro com esses dados.";
  return error.message;
}
