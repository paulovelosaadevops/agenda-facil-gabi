import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { env } from "@/lib/env";
import { SIMULATOR_PHONE } from "@/lib/simulator";
import { AiTabs } from "./ai-tabs";
import { CaptionGenerator } from "./caption-generator";
import { Simulator, type ChatMessage } from "./simulator";

export const metadata: Metadata = { title: "Inteligência" };

export default async function AiPage({ searchParams }: PageProps<"/painel/ia">) {
  const { aba } = await searchParams;
  const { db, business } = await requireBusiness();
  const { data } = await db
    .from("messages")
    .select("id, direction, body")
    .eq("business_id", business.id)
    .eq("phone", SIMULATOR_PHONE)
    .order("created_at")
    .limit(100)
    .returns<ChatMessage[]>();

  const configured = env.aiConfigured();

  return (
    <>
      <PageHeader title="Inteligência" subtitle="Legendas prontas e uma atendente que agenda por você." />
      {!configured && (
        <div className="mb-6">
          <Alert tone="info">A IA ainda não foi configurada no servidor. Defina ANTHROPIC_API_KEY no .env.local.</Alert>
        </div>
      )}
      <AiTabs
        initial={aba === "atendente" ? "atendente" : "legendas"}
        captions={<CaptionGenerator />}
        assistant={
          <Simulator
            messages={data ?? []}
            error={business.ai_enabled ? undefined : "A atendente está desligada em Ajustes › Atendente virtual."}
          />
        }
      />
    </>
  );
}
