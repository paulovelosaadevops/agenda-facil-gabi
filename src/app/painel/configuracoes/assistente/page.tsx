import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Alert, List, Row, SwitchRow, TextAreaRow } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { env } from "@/lib/env";
import { saveAi } from "../actions";
import { SettingsForm } from "../settings-form";

export const metadata: Metadata = { title: "Atendente virtual" };

export default async function AssistantSettingsPage() {
  const { business } = await requireBusiness();
  return (
    <>
      <PageHeader title="Atendente virtual" back={{ href: "/painel/configuracoes", label: "Ajustes" }} />
      {!env.aiConfigured() && (
        <div className="mb-6">
          <Alert tone="info">A IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).</Alert>
        </div>
      )}
      <SettingsForm action={saveAi}>
        <List footer="A atendente responde suas clientes no WhatsApp: tira dúvidas, mostra horários livres, agenda e cancela.">
          <SwitchRow name="ai_enabled" defaultChecked={business.ai_enabled} label="Responder automaticamente" />
        </List>
        <List
          header="Instruções"
          footer="Ex.: aceito Pix e cartão; tolerância de 15 min de atraso; cobro sinal de 30% em alongamentos; não faço unha de fibra."
        >
          <TextAreaRow
            name="ai_instructions"
            defaultValue={business.ai_instructions}
            placeholder="Regras e informações que a atendente deve saber"
            className="min-h-36"
          />
        </List>
        <List>
          <Row href="/painel/ia?aba=atendente" title="Testar a atendente" tone="accent" chevron />
        </List>
      </SettingsForm>
    </>
  );
}
