"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

const Credentials = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await createSupabaseServer();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos." };

  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/painel") ? next : "/painel");
}

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await createSupabaseServer();
  const { data, error } = await db.auth.signUp(parsed.data);
  if (error) return { error: error.message };
  if (!data.session) return { message: "Enviamos um link de confirmação para o seu e-mail." };
  redirect("/onboarding");
}

export async function logout() {
  const db = await createSupabaseServer();
  await db.auth.signOut();
  redirect("/login");
}
