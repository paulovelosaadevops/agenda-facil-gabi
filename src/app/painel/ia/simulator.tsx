"use client";

import clsx from "clsx";
import { ArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { simulatorReset, simulatorSend } from "./actions";

export interface ChatMessage {
  id: string;
  direction: "in" | "out";
  body: string;
}

const SUGGESTIONS = ["Quanto custa o alongamento?", "Tem horário sexta à tarde?", "Quero cancelar meu horário"];

/** Renderiza *negrito* do WhatsApp. */
function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.length > 2 && part.startsWith("*") && part.endsWith("*") ? <strong key={i}>{part.slice(1, -1)}</strong> : part,
      )}
    </>
  );
}

export function Simulator({ messages, error: configError }: { messages: ChatMessage[]; error?: string }) {
  const [optimistic, addOptimistic] = useOptimistic(messages, (state, msg: ChatMessage) => [...state, msg]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [optimistic.length, pending]);

  const send = (value: string) => {
    const body = value.trim();
    if (!body || pending) return;
    setText("");
    setError(undefined);
    startTransition(async () => {
      addOptimistic({ id: `tmp-${Date.now()}`, direction: "in", body });
      const result = await simulatorSend(body);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex h-[calc(100dvh-19rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl bg-surface md:h-[600px]">
      <div className="flex items-center justify-between border-b-[0.5px] border-separator px-4 py-2.5">
        <div className="w-8" />
        <div className="text-center">
          <p className="text-[15px] font-semibold">Cliente de teste</p>
          <p className="text-[12px] text-label-2">{pending ? "digitando…" : "simulação · agenda real"}</p>
        </div>
        <button
          type="button"
          aria-label="Reiniciar conversa"
          title="Reiniciar conversa"
          onClick={() => startTransition(() => simulatorReset())}
          className="flex size-8 items-center justify-center rounded-full text-accent hover:bg-fill-2"
        >
          <RotateCcw className="size-[18px]" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {optimistic.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-[15px] text-label-2">Escreva como se fosse uma cliente. A atendente consulta seus serviços e horários de verdade.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full bg-fill px-3.5 py-1.5 text-[13px] font-medium transition hover:bg-fill/70 active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {optimistic.map((m, i) => {
          const mine = m.direction === "in"; // quem testa faz o papel da cliente
          const lastOfGroup = optimistic[i + 1]?.direction !== m.direction;
          return (
            <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start", lastOfGroup && "pb-1.5")}>
              <div
                className={clsx(
                  "max-w-[78%] rounded-[18px] px-3.5 py-2 text-[16px] leading-snug whitespace-pre-line md:text-[15px]",
                  mine ? "bg-accent-strong text-accent-fg" : "bg-fill",
                  lastOfGroup && (mine ? "rounded-br-[6px]" : "rounded-bl-[6px]"),
                )}
              >
                <WhatsAppText text={m.body} />
              </div>
            </div>
          );
        })}
        {pending && (
          <div className="flex">
            <div className="flex gap-1 rounded-[18px] rounded-bl-[6px] bg-fill px-4 py-3" aria-label="Digitando">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-2 rounded-full bg-label-2" style={{ animation: `typing 1.2s ${d * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {(error || configError) && <p className="px-4 pb-2 text-center text-[13px] text-red">{error ?? configError}</p>}

      <form
        className="flex items-end gap-2 border-t-[0.5px] border-separator px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem"
          aria-label="Mensagem"
          className="h-9 min-w-0 flex-1 rounded-full border-[0.5px] border-separator bg-transparent px-4 text-[16px] outline-none placeholder:text-label-3 focus:border-label-3 md:text-[15px]"
        />
        <button
          aria-label="Enviar"
          disabled={pending || !text.trim()}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-strong text-accent-fg transition active:scale-90 disabled:bg-fill disabled:text-label-3"
        >
          <ArrowUp className="size-5" strokeWidth={2.75} />
        </button>
      </form>
    </div>
  );
}
