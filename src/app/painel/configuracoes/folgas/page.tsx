import { CalendarOff } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { EmptyState, List } from "@/components/ui";
import { toDateKey } from "@/lib/availability";
import { requireBusiness } from "@/lib/auth";
import { formatInTz } from "@/lib/format";
import type { TimeOff } from "@/lib/types";
import { DeleteTimeOffButton, NewTimeOffButton } from "./time-off";

export const metadata: Metadata = { title: "Folgas e bloqueios" };

function describe(t: TimeOff, timeZone: string) {
  const start = new Date(t.starts_at);
  // Fim exclusivo à meia-noite: mostra o dia anterior como último dia.
  const end = new Date(new Date(t.ends_at).getTime() - 1);
  const midnight = (d: Date) => formatInTz(d, "HH:mm", timeZone) === "00:00";
  const allDay = midnight(start) && midnight(new Date(t.ends_at));
  const sameDay = toDateKey(start, timeZone) === toDateKey(end, timeZone);
  if (allDay) {
    return sameDay
      ? formatInTz(start, "EEEE, d 'de' MMM", timeZone)
      : `${formatInTz(start, "d 'de' MMM", timeZone)} – ${formatInTz(end, "d 'de' MMM", timeZone)}`;
  }
  return sameDay
    ? `${formatInTz(start, "d 'de' MMM, HH:mm", timeZone)} – ${formatInTz(t.ends_at, "HH:mm", timeZone)}`
    : `${formatInTz(start, "d/MM HH:mm", timeZone)} – ${formatInTz(t.ends_at, "d/MM HH:mm", timeZone)}`;
}

export default async function TimeOffPage() {
  const { db, business } = await requireBusiness();
  const { data } = await db
    .from("time_off")
    .select("*")
    .eq("business_id", business.id)
    .gte("ends_at", new Date().toISOString())
    .order("starts_at")
    .returns<TimeOff[]>();
  const items = data ?? [];

  return (
    <>
      <PageHeader
        title="Folgas"
        back={{ href: "/painel/configuracoes", label: "Ajustes" }}
        actions={<NewTimeOffButton today={toDateKey(new Date(), business.timezone)} />}
      />
      {items.length ? (
        <List footer="Os períodos bloqueados somem do link de agendamento e da atendente virtual.">
          {items.map((t) => (
            <div
              key={t.id}
              className="relative flex items-center gap-3 py-2 pr-2 pl-4 after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-separator last:after:hidden"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] first-letter:uppercase md:text-[15px]">{describe(t, business.timezone)}</span>
                {t.reason && <span className="block truncate text-[13px] text-label-2">{t.reason}</span>}
              </span>
              <DeleteTimeOffButton id={t.id} />
            </div>
          ))}
        </List>
      ) : (
        <EmptyState icon={<CalendarOff className="size-10" strokeWidth={1.5} />} title="Nenhum bloqueio">
          Toque em + para bloquear férias, cursos ou compromissos.
        </EmptyState>
      )}
    </>
  );
}
