import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentList } from "@/components/appointment-list";
import { PageHeader } from "@/components/page-header";
import { EmptyState, buttonClass } from "@/components/ui";
import { dayBounds, toDateKey } from "@/lib/availability";
import { requireBusiness } from "@/lib/auth";
import { formatInTz, formatMoney } from "@/lib/format";
import type { AppointmentWithRefs, Service } from "@/lib/types";
import { NewAppointmentButton } from "./new-appointment";
import { WeekStrip } from "./week-strip";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/painel/agenda">) {
  const { db, business } = await requireBusiness();
  const tzName = business.timezone;
  const today = toDateKey(new Date(), tzName);
  const params = await searchParams;
  const date = typeof params.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.data) ? params.data : today;
  const { start, end } = dayBounds(date, tzName);
  const noon = new Date(start.getTime() + 12 * 3_600_000);
  const weekStart = dayBounds(toDateKey(addDays(noon, -new TZDate(noon.getTime(), tzName).getDay()), tzName), tzName).start;
  const weekEnd = addDays(weekStart, 7);

  const [{ data: appts }, { data: week }, { data: services }, { data: clients }] = await Promise.all([
    db
      .from("appointments")
      .select("*, clients(id, name, phone), services(id, name, duration_min)")
      .eq("business_id", business.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at")
      .returns<AppointmentWithRefs[]>(),
    db
      .from("appointments")
      .select("starts_at")
      .eq("business_id", business.id)
      .in("status", ["pending", "confirmed", "completed"])
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at", weekEnd.toISOString()),
    db.from("services").select("*").eq("business_id", business.id).eq("active", true).order("name").returns<Service[]>(),
    db.from("clients").select("id, name").eq("business_id", business.id).order("name"),
  ]);

  const list = appts ?? [];
  const busyDays = new Set((week ?? []).map((a) => toDateKey(new Date(a.starts_at), tzName)));
  const active = list.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const expected = active.reduce((sum, a) => sum + a.price_cents, 0);
  const clientParam = typeof params.cliente === "string" ? params.cliente : undefined;

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={
          <>
            {date !== today && (
              <Link href="?" replace scroll={false} className={buttonClass("plain", "md")}>
                Hoje
              </Link>
            )}
            <NewAppointmentButton
              key={date}
              clients={clients ?? []}
              services={services ?? []}
              defaultDate={date}
              initialOpen={params.novo === "1" || Boolean(clientParam)}
              initialClientId={clientParam}
            />
          </>
        }
      />

      <WeekStrip date={date} today={today} timeZone={tzName} busyDays={busyDays} />

      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[20px] font-bold tracking-tight first-letter:uppercase">
          {date === today ? "Hoje" : formatInTz(noon, "EEEE, d 'de' MMM", tzName)}
        </h2>
        {active.length > 0 && (
          <p className="text-[13px] text-label-2 tabular-nums">
            {active.length} {active.length === 1 ? "atendimento" : "atendimentos"} · {formatMoney(expected)}
          </p>
        )}
      </div>

      {list.length ? (
        <AppointmentList appointments={list} timeZone={tzName} />
      ) : (
        <div className="rounded-xl bg-surface">
          <EmptyState icon={<CalendarDays className="size-10" strokeWidth={1.5} />} title="Dia livre">
            Nenhum agendamento para este dia.
          </EmptyState>
        </div>
      )}
    </>
  );
}
