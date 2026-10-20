"use client";

import { Check } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import type { SettingsState } from "./actions";

/** Formulário de ajustes com botão Salvar e confirmação discreta. */
export function SettingsForm({
  action,
  children,
  submitLabel = "Salvar",
}: {
  action: (state: SettingsState, form: FormData) => Promise<SettingsState>;
  children: ReactNode;
  submitLabel?: string;
}) {
  // Conta os envios para remontar o aviso "salvo" (e reiniciar a animação) a cada salvamento.
  const [state, formAction] = useActionState<(SettingsState & { n?: number }) | undefined, FormData>(
    async (prev, form) => {
      const result = await action(prev, form);
      return result && { ...result, n: (prev?.n ?? 0) + 1 };
    },
    undefined,
  );

  return (
    <form action={formAction}>
      {children}
      {state?.error && (
        <div className="mb-4">
          <Alert>{state.error}</Alert>
        </div>
      )}
      <div className="md:flex md:justify-end">
        <SubmitButton className="md:w-auto md:min-w-40">{submitLabel}</SubmitButton>
      </div>
      <p role="status" className="mt-3 flex h-5 items-center justify-center md:justify-end">
        {state?.ok && (
          <span key={state.n} className="animate-saved flex items-center gap-1.5 text-[13px] font-medium text-green">
            <Check className="size-4" strokeWidth={3} /> Alterações salvas
          </span>
        )}
      </p>
    </form>
  );
}
