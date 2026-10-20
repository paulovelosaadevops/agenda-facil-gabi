"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** Busca no estilo iOS que filtra enquanto digita. */
export function SearchField({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      startTransition(() => router.replace(value.trim() ? `?q=${encodeURIComponent(value.trim())}` : "?", { scroll: false }));
    }, 250);
    return () => clearTimeout(t);
  }, [value, router]);

  return (
    <div className="relative mb-5">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-[17px] -translate-y-1/2 text-label-2" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar"
        aria-label="Buscar clientes"
        className="h-9 w-full rounded-[10px] bg-fill pr-8 pl-8 text-[16px] outline-none placeholder:text-label-2 md:text-[15px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-label-3 text-surface"
        >
          <X className="size-3" strokeWidth={3} />
        </button>
      )}
      {pending && <span className="absolute top-1/2 right-8 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-label-3 border-t-transparent" />}
    </div>
  );
}
