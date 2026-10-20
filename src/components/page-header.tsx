"use client";

import clsx from "clsx";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Cabeçalho no estilo iOS: título grande que, ao rolar, vira um título pequeno
 * numa barra translúcida fixa no topo. `largeTitle={false}` para telas com cabeçalho próprio.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  largeTitle = true,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  largeTitle?: boolean;
}) {
  const [compact, setCompact] = useState(false);
  const threshold = largeTitle ? 40 : 110;

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return (
    <>
      <div
        className={clsx(
          "sticky top-0 z-30 -mx-4 px-4 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200 md:-mx-10 md:px-10",
          compact ? "bg-bar shadow-[0_0.5px_0_var(--separator)] backdrop-blur-xl backdrop-saturate-150" : "bg-bg/0",
        )}
      >
        <div className="relative flex h-12 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            {back && (
              <Link href={back.href} className="-ml-2 flex items-center text-[17px] text-accent active:opacity-60">
                <ChevronLeft className="size-7" strokeWidth={2} />
                <span className="truncate">{back.label}</span>
              </Link>
            )}
          </div>
          <p
            className={clsx(
              "pointer-events-none absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate text-[17px] font-semibold transition-opacity duration-200",
              compact ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={!compact}
          >
            {title}
          </p>
          <div className="flex flex-1 items-center justify-end gap-2">{actions}</div>
        </div>
      </div>
      {largeTitle && (
        <header className="pt-1 pb-5">
          <h1 className="text-[34px] leading-[41px] font-bold tracking-[-0.025em]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[15px] text-label-2 first-letter:uppercase">{subtitle}</p>}
        </header>
      )}
    </>
  );
}
