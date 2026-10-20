import { BellRing, CalendarDays, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppMark, buttonClass } from "@/components/ui";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+3rem)]">
      <section className="flex max-w-2xl flex-col items-center text-center">
        <AppMark size={80} />
        <h1 className="mt-8 text-[44px] leading-[1.05] font-bold tracking-[-0.035em] sm:text-[64px]">
          Sua agenda,
          <br />
          <span className="bg-gradient-to-r from-[#ff7aa5] to-[#b8245a] bg-clip-text text-transparent">no automático.</span>
        </h1>
        <p className="mt-5 max-w-md text-[19px] leading-snug text-label-2">
          Agendamento online, lembretes no WhatsApp e uma atendente com IA. Feito para nail designers.
        </p>
        <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
          <Link href="/cadastro" className={buttonClass("filled", "lg", "min-w-48 rounded-full")}>
            Começar grátis
          </Link>
          <Link href="/login" className={buttonClass("plain", "lg", "font-normal")}>
            Já tenho conta ›
          </Link>
        </div>
      </section>

      <section className="mt-20 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <Feature icon={<CalendarDays className="size-6" />} title="Link de agendamento">
          A cliente escolhe serviço e horário sozinha, sem trocar mensagens.
        </Feature>
        <Feature icon={<BellRing className="size-6" />} title="Lembretes automáticos">
          Confirmação e lembrete no WhatsApp. Menos faltas, zero esforço.
        </Feature>
        <Feature icon={<Sparkles className="size-6" />} title="Atendente com IA">
          Responde dúvidas e agenda pelo WhatsApp enquanto você atende.
        </Feature>
      </section>
    </main>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-6">
      <div className="text-accent">{icon}</div>
      <h2 className="mt-4 text-[17px] font-semibold">{title}</h2>
      <p className="mt-1 text-[15px] leading-snug text-label-2">{children}</p>
    </div>
  );
}
