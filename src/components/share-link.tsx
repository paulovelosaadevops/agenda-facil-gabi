"use client";

import { Check, Copy, Share } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { buttonClass } from "./ui";

/** Copiar e compartilhar (folha de compartilhamento nativa do celular, quando existir). */
export function ShareLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // Só existe no navegador (e não em todos): false no servidor, valor real após hidratar.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={buttonClass("tinted", "sm")}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? <Check className="size-3.5" strokeWidth={3} /> : <Copy className="size-3.5" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
      {canShare && (
        <button
          type="button"
          className={buttonClass("tinted", "sm")}
          onClick={() => navigator.share({ title, url }).catch(() => {})}
        >
          <Share className="size-3.5" />
          Compartilhar
        </button>
      )}
    </div>
  );
}
