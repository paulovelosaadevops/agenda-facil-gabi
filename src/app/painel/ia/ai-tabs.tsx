"use client";

import clsx from "clsx";
import { useState, type ReactNode } from "react";

/** Abas com controle segmentado. As duas ficam montadas para não perder o que foi digitado. */
export function AiTabs({ initial, captions, assistant }: { initial: "legendas" | "atendente"; captions: ReactNode; assistant: ReactNode }) {
  const [tab, setTab] = useState(initial);
  const tabs = [
    { id: "legendas", label: "Legendas" },
    { id: "atendente", label: "Atendente WhatsApp" },
  ] as const;

  return (
    <>
      <div role="tablist" className="mb-6 grid grid-cols-2 rounded-[9px] bg-fill p-0.5 md:max-w-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "h-8 rounded-[7px] text-[13px] transition",
              tab === t.id ? "bg-segment font-semibold shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]" : "font-medium",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div hidden={tab !== "legendas"}>{captions}</div>
      <div hidden={tab !== "atendente"}>{assistant}</div>
    </>
  );
}
