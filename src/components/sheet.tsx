"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Painel modal: sobe de baixo no celular e aparece centralizado no desktop.
 * Usa <dialog> nativo (foco preso, Esc fecha, acessível).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // toque fora do painel
      }}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <header className="relative flex h-14 shrink-0 items-center px-4">
            <span className="absolute top-1.5 left-1/2 h-[5px] w-9 -translate-x-1/2 rounded-full bg-label-3 md:hidden" aria-hidden />
            <button type="button" onClick={onClose} className="text-[17px] text-accent active:opacity-60">
              Cancelar
            </button>
            <h2 className="pointer-events-none absolute left-1/2 max-w-[55%] -translate-x-1/2 truncate text-[17px] font-semibold">
              {title}
            </h2>
          </header>
          <div className="overflow-y-auto overscroll-contain px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
