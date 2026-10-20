import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AppMark } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { TabBar, SideNav } from "./nav";

// Lê a sessão, então fica atrás de um Suspense; o resto do layout é estático.
async function SidebarStudio() {
  const { business } = await requireBusiness();
  return (
    <a
      href={`/agendar/${business.slug}`}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-label-2 hover:bg-fill-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-label">{business.name}</span>
        <span className="block truncate">Ver página de agendamento</span>
      </span>
      <ExternalLink className="size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
    </a>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r-[0.5px] border-separator bg-surface/70 px-3 pt-5 pb-3 backdrop-blur-xl md:flex">
        <Link href="/painel" className="mb-6 flex items-center gap-2.5 px-2.5">
          <AppMark size={28} />
          <span className="text-[15px] font-semibold tracking-tight">Agenda Fácil</span>
        </Link>
        <SideNav />
        <div className="mt-auto">
          <Suspense fallback={<div className="h-12" />}>
            <SidebarStudio />
          </Suspense>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:px-10 md:pb-16">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
