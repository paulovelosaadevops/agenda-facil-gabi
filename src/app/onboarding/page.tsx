"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AppMark, FormRow, List, RowInput } from "@/components/ui";
import { createBusiness, type OnboardingState } from "./actions";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default function OnboardingPage() {
  const [state, action] = useActionState<OnboardingState, FormData>(createBusiness, undefined);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <AppMark size={64} />
          <h1 className="mt-5 text-[28px] font-bold tracking-tight">Seu estúdio</h1>
          <p className="mt-1 max-w-xs text-[15px] text-label-2">
            Já deixamos um expediente e alguns serviços de exemplo. Você ajusta tudo depois.
          </p>
        </div>
        <form action={action}>
          <List footer={`Suas clientes vão agendar em /agendar/${slug || "seu-link"}`}>
            <FormRow label="Nome">
              <RowInput
                name="name"
                required
                placeholder="Studio Bella"
                autoComplete="organization"
                onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
              />
            </FormRow>
            <FormRow label="Link">
              <RowInput
                name="slug"
                required
                value={slug}
                placeholder="studio-bella"
                autoCapitalize="none"
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </FormRow>
          </List>
          <List footer="Opcional. Aparece para as clientes na página de agendamento.">
            <FormRow label="WhatsApp">
              <RowInput name="phone" type="tel" placeholder="(11) 99999-8888" />
            </FormRow>
          </List>
          {state?.error && (
            <div className="mb-4">
              <Alert>{state.error}</Alert>
            </div>
          )}
          <SubmitButton pendingText="Criando...">Continuar</SubmitButton>
        </form>
      </div>
    </main>
  );
}
