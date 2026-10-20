"use client";

import clsx from "clsx";
import { CalendarDays, House, Settings, Sparkles, Tag, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Outras rotas que acendem este item. */
  also?: string[];
}

const SIDEBAR: NavItem[] = [
  { href: "/painel", label: "Início", icon: House },
  { href: "/painel/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/servicos", label: "Serviços", icon: Tag },
  { href: "/painel/ia", label: "Inteligência", icon: Sparkles },
  { href: "/painel/configuracoes", label: "Ajustes", icon: Settings },
];

// No celular, no máximo 5 abas (padrão do iOS): Serviços fica dentro de Ajustes.
const TABS: NavItem[] = [
  { href: "/painel", label: "Início", icon: House },
  { href: "/painel/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/ia", label: "IA", icon: Sparkles },
  { href: "/painel/configuracoes", label: "Ajustes", icon: Settings, also: ["/painel/servicos"] },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/painel") return pathname === "/painel";
  return [item.href, ...(item.also ?? [])].some((p) => pathname.startsWith(p));
}

// usePathname() é dado de URL: fica atrás de Suspense, com a versão sem destaque como fallback.
export function SideNav() {
  return (
    <Suspense fallback={<SideNavLinks pathname="" />}>
      <SideNavWithPath />
    </Suspense>
  );
}

function SideNavWithPath() {
  return <SideNavLinks pathname={usePathname()} />;
}

function SideNavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="space-y-0.5">
      {SIDEBAR.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors",
              active ? "bg-fill font-medium text-label" : "text-label hover:bg-fill-2",
            )}
          >
            <Icon className="size-[18px] text-accent" strokeWidth={1.9} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  return (
    <Suspense fallback={<TabBarLinks pathname="" />}>
      <TabBarWithPath />
    </Suspense>
  );
}

function TabBarWithPath() {
  return <TabBarLinks pathname={usePathname()} />;
}

function TabBarLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-[0.5px] border-separator bg-bar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden">
      <div className="grid grid-cols-5">
        {TABS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex flex-col items-center gap-[3px] pt-2 pb-1.5 text-[10px] font-medium transition-colors",
                active ? "text-accent" : "text-label-2",
              )}
            >
              <Icon className="size-[25px]" strokeWidth={active ? 2.1 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
