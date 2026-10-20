"use client";

import clsx from "clsx";
import { Check, Copy, ImagePlus } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, List, TextAreaRow } from "@/components/ui";
import { captionsAction, type CaptionState } from "./actions";

const TONES = [
  { value: "delicado e elegante", label: "Elegante" },
  { value: "divertido e descontraído", label: "Divertido" },
  { value: "sofisticado e minimalista", label: "Minimalista" },
  { value: "promocional, com senso de urgência", label: "Promocional" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-[13px] font-semibold text-accent active:opacity-60"
    >
      {copied ? <Check className="size-3.5" strokeWidth={3} /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export function CaptionGenerator() {
  const [state, action] = useActionState<CaptionState, FormData>(captionsAction, undefined);
  const [preview, setPreview] = useState<string>();
  const hashtags = state?.result?.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ") ?? "";

  return (
    <div className="md:grid md:grid-cols-2 md:gap-8">
      <form action={action}>
        <label
          className={clsx(
            "relative mb-7 flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl transition",
            preview ? "bg-surface" : "border-2 border-dashed border-separator bg-surface hover:bg-fill-2",
          )}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
              <img src={preview} alt="Foto escolhida" className="absolute inset-0 size-full object-cover" />
              <span className="absolute right-3 bottom-3 rounded-full bg-black/55 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur">
                Trocar foto
              </span>
            </>
          ) : (
            <>
              <ImagePlus className="size-9 text-accent" strokeWidth={1.5} />
              <span className="mt-2 text-[15px] font-medium text-accent">Escolher foto</span>
              <span className="mt-0.5 text-[13px] text-label-2">JPG, PNG ou WEBP até 5 MB</span>
            </>
          )}
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : undefined);
            }}
          />
        </label>

        <List header="Sobre o trabalho">
          <TextAreaRow name="description" placeholder="Ex.: alongamento em gel, francesinha com glitter dourado, formato amendoado" className="min-h-20" />
        </List>

        <section className="mb-7">
          <h2 className="px-4 pb-2 text-[13px] text-label-2 uppercase">Tom</h2>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t, i) => (
              <label
                key={t.value}
                className="cursor-pointer rounded-full bg-surface px-4 py-2 text-[15px] transition has-[:checked]:bg-accent-strong has-[:checked]:font-medium has-[:checked]:text-accent-fg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50"
              >
                <input type="radio" name="tone" value={t.value} defaultChecked={i === 0} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
        </section>

        <SubmitButton pendingText="Criando legendas...">Gerar legendas</SubmitButton>
      </form>

      <div className="mt-8 md:mt-0">
        {state?.error && <Alert>{state.error}</Alert>}
        {state?.result ? (
          <div className="animate-fade-in space-y-3">
            {state.result.legendas.map((l, i) => (
              <div key={i} className="rounded-2xl bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-label-2">{l.estilo}</span>
                  <CopyButton text={`${l.texto}\n\n${hashtags}`} />
                </div>
                <p className="text-[15px] leading-relaxed whitespace-pre-line">{l.texto}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-label-2">Hashtags</span>
                <CopyButton text={hashtags} />
              </div>
              <p className="text-[15px] leading-relaxed text-accent">{hashtags}</p>
            </div>
          </div>
        ) : (
          !state?.error && (
            <p className="hidden pt-24 text-center text-[15px] text-label-2 md:block">
              As legendas aparecem aqui.
              <br />
              Cada uma já vem com hashtags para copiar.
            </p>
          )
        )}
      </div>
    </div>
  );
}
