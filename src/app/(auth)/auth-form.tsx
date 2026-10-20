"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AppMark } from "@/components/ui";
import { login, signup, type AuthState } from "./actions";

const fieldClass =
  "relative block h-12 w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-label-3 focus:bg-fill-2";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  const isLogin = mode === "login";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <AppMark size={64} />
          <h1 className="mt-5 text-[28px] font-bold tracking-tight">{isLogin ? "Entrar" : "Criar conta"}</h1>
          <p className="mt-1 text-[15px] text-label-2">{isLogin ? "Bem-vinda de volta." : "Sua agenda pronta em um minuto."}</p>
        </div>

        <form action={action}>
          {next && <input type="hidden" name="next" value={next} />}
          <div className="mb-4 overflow-hidden rounded-xl bg-surface">
            <input name="email" type="email" autoComplete="email" required placeholder="E-mail" aria-label="E-mail" className={fieldClass} />
            <div className="ml-4 h-px bg-separator" />
            <input
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={8}
              required
              placeholder={isLogin ? "Senha" : "Senha (mínimo 8 caracteres)"}
              aria-label="Senha"
              className={fieldClass}
            />
          </div>
          {state?.error && (
            <div className="mb-4">
              <Alert>{state.error}</Alert>
            </div>
          )}
          {state?.message && (
            <div className="mb-4">
              <Alert tone="success">{state.message}</Alert>
            </div>
          )}
          <SubmitButton pendingText="Aguarde...">{isLogin ? "Entrar" : "Continuar"}</SubmitButton>
        </form>

        <p className="mt-6 text-center text-[15px] text-label-2">
          {isLogin ? "Ainda não tem conta? " : "Já tem conta? "}
          <Link className="font-medium text-accent" href={isLogin ? "/cadastro" : "/login"}>
            {isLogin ? "Criar conta" : "Entrar"}
          </Link>
        </p>
      </div>
    </main>
  );
}
