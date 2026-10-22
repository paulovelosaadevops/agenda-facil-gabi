import { useEffect, useState } from "react";
import { callFunction } from "@/lib/supabase";
import { disablePush, enablePush, getPushStatus, type PushStatus } from "@/lib/web-push";
import { Banner, Row, RowIcon, Section } from "./ui";

const FOOTER: Record<PushStatus, string> = {
  unsupported:
    "Funciona no app instalado pela Tela de Início do celular (iPhone com iOS 16.4 ou mais novo, ou Android). Abra o app por lá para ativar.",
  "needs-install": "No iPhone, adicione o app à Tela de Início (Safari › Compartilhar › Adicionar à Tela de Início) e abra por lá para ativar.",
  denied: "As notificações foram bloqueadas. Libere em Ajustes do celular › Notificações › Gabi Marqui.",
  off: "Receba na tela do celular cada agendamento novo feito pelo link, mesmo com o app fechado.",
  on: "Você recebe neste aparelho cada agendamento novo feito pelo link.",
};

/** Ajustes › Notificações no celular (Web Push do app instalado). */
export function PushSettings({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<PushStatus>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();

  useEffect(() => {
    let active = true;
    getPushStatus().then((s) => active && setStatus(s));
    return () => {
      active = false;
    };
  }, []);

  const run = async (fn: () => Promise<string | undefined>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      const text = await fn();
      if (text) setMessage({ tone: "success", text });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Não foi possível concluir." });
    } finally {
      setStatus(await getPushStatus());
      setBusy(false);
    }
  };

  if (!status) return null;
  return (
    <>
      <Section header="Notificações no celular" footer={FOOTER[status]}>
        {status === "off" && (
          <Row
            leading={<RowIcon name="bell" />}
            title={busy ? "Ativando…" : "Ativar notificações"}
            tone="accent"
            onPress={() =>
              run(async () => {
                await enablePush(businessId);
                await callFunction("panel", { action: "push-test" });
                return "Pronto! Enviamos uma notificação de teste.";
              })
            }
          />
        )}
        {status === "on" && (
          <>
            <Row leading={<RowIcon name="bellOn" />} title="Ativadas neste aparelho" />
            <Row
              title={busy ? "Enviando…" : "Enviar notificação de teste"}
              tone="accent"
              onPress={() =>
                run(async () => {
                  const { sent } = await callFunction<{ sent: number }>("panel", { action: "push-test" });
                  return sent ? "Notificação de teste enviada." : "Nenhum aparelho recebeu. Desative e ative de novo.";
                })
              }
            />
            <Row title="Desativar neste aparelho" tone="destructive" onPress={() => run(async () => (await disablePush(), "Notificações desativadas."))} />
          </>
        )}
        {(status === "unsupported" || status === "needs-install" || status === "denied") && (
          <Row leading={<RowIcon name="bell" />} title="Notificações no celular" detail={status === "denied" ? "Bloqueadas" : "Indisponível aqui"} />
        )}
      </Section>
      {message && <Banner tone={message.tone === "success" ? "success" : "error"}>{message.text}</Banner>}
    </>
  );
}
