import { TZDate } from "@date-fns/tz";
import { addDays, differenceInMinutes } from "date-fns";
import { CalendarCheck, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { AppointmentList } from "@/components/appointment-list";
import { PageHeader } from "@/components/page-header";
import { ShareLink } from "@/components/share-link";
import { Avatar, List, Row, iconButtonClass } from "@/components/ui";
import { dayBounds, toDateKey } from "@/lib/availability";
import { requireBusiness } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatInTz } from "@/lib/format";
import type { AppointmentWithRefs } from "@/lib/types";

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function relativeTime(target: Date, now: Date, timeZone: string) {
  const minutes = differenceInMinutes(target, now);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `em ${minutes} min`;
  if (toDateKey(target, timeZone) === toDateKey(now, timeZone)) {
    const h = Math.floor(minutes / 60);
    return `em ${h} h`;
  }
  if (toDateKey(target, timeZone) === toDateKey(addDays(now, 1), timeZone)) return "amanhã";
  return formatInTz(target, "EEEE", timeZone);
}

const compactMoney = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: cents >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: cents >= 1_000_000 ? 1 : 0 });

export default async function DashboardPage() {
  const { db, business } = await requireBusiness();
  const tzName = business.timezone;
  const now = new Date();
  const today = dayBounds(toDateKey(now, tzName), tzName);
  const local = new TZDate(now.getTime(), tzName);
  const monthStart = new Date(new TZDate(local.getFullYear(), local.getMonth(), 1, 0, 0, 0, tzName).getTime());
  const weekEnd = addDays(today.start, 7);

  const [{ data: todayAppts }, { data: next }, { data: monthDone }, { count: upcoming }, { data: birthdays }] = await Promise.all([
    db
      .from("appointments")
      .select("*, clients(id, name, phone), services(id, name, duration_min)")
      .eq("business_id", business.id)
      .gte("starts_at", today.start.toISOString())
      .lt("starts_at", today.end.toISOString())
      .order("starts_at")
      .returns<AppointmentWithRefs[]>(),
    db
      .from("appointments")
      .select("*, clients(id, name, phone), services(id, name, duration_min)")
      .eq("business_id", business.id)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", now.toISOString())
      .order("starts_at")
      .limit(1)
      .returns<AppointmentWithRefs[]>(),
    db
      .from("appointments")
      .select("price_cents")
      .eq("business_id", business.id)
      .eq("status", "completed")
      .gte("starts_at", monthStart.toISOString()),
    db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", now.toISOString())
      .lt("starts_at", weekEnd.toISOString()),
    db.from("clients").select("id, name, birthday").eq("business_id", business.id).not("birthday", "is", null),
  ]);

  const list = todayAppts ?? [];
  const todayActive = list.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const nextAppt = next?.[0];
  const monthRevenue = (monthDone ?? []).reduce((sum, a) => sum + a.price_cents, 0);
  const month = local.getMonth() + 1;
  const birthdaysThisMonth = (birthdays ?? [])
    .filter((c) => Number(c.birthday!.slice(5, 7)) === month)
    .sort((a, b) => a.birthday!.slice(8).localeCompare(b.birthday!.slice(8)));
  const publicUrl = `${env.appUrl()}/agendar/${business.slug}`;

  return (
    <>
      <PageHeader
        title={greeting(local.getHours())}
        subtitle={formatInTz(now, "EEEE, d 'de' MMMM", tzName)}
        actions={
          <Link href="/painel/agenda?novo=1" aria-label="Novo agendamento" className={iconButtonClass("tinted")}>
            <Plus className="size-5" strokeWidth={2.5} />
          </Link>
        }
      />

      {nextAppt ? (
        <Link
          href={`/painel/agenda?data=${toDateKey(new Date(nextAppt.starts_at), tzName)}`}
          className="mb-4 block rounded-2xl bg-gradient-to-br from-[#ff7aa5] via-[#e5396f] to-[#b8245a] p-5 text-white transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between text-[13px] font-semibold text-white/80 uppercase">
            <span>Próximo atendimento</span>
            <span className="normal-case">{relativeTime(new Date(nextAppt.starts_at), now, tzName)}</span>
          </div>
          <p className="mt-2 text-[40px] leading-none font-bold tracking-tight tabular-nums">
            {formatInTz(nextAppt.starts_at, "HH:mm", tzName)}
          </p>
          <p className="mt-3 text-[17px] font-semibold">{nextAppt.clients?.name}</p>
          <p className="text-[15px] text-white/80">{nextAppt.services?.name}</p>
        </Link>
      ) : (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface p-5">
          <CalendarCheck className="size-8 text-label-3" strokeWidth={1.5} />
          <div>
            <p className="font-semibold">Nenhum atendimento marcado</p>
            <p className="text-[13px] text-label-2">Compartilhe seu link para receber agendamentos.</p>
          </div>
        </div>
      )}

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Stat label="Hoje" value={String(todayActive.length)} />
        <Stat label="7 dias" value={String(upcoming ?? 0)} />
        <Stat label="No mês" value={compactMoney(monthRevenue)} />
      </div>

      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[20px] font-bold tracking-tight">Hoje</h2>
        <Link href="/painel/agenda" className="flex items-center text-[15px] text-accent">
          Agenda <ChevronRight className="size-4" strokeWidth={2.5} />
        </Link>
      </div>
      <div className="mb-8">
        {list.length ? (
          <AppointmentList appointments={list} timeZone={tzName} />
        ) : (
          <p className="rounded-xl bg-surface px-4 py-6 text-center text-[15px] text-label-2">Nenhum agendamento hoje.</p>
        )}
      </div>

      <List header="Link de agendamento" footer="Coloque na bio do Instagram e na mensagem de ausência do WhatsApp.">
        <div className="px-4 py-3">
          <p className="mb-3 truncate text-[15px] text-label-2">{publicUrl.replace(/^https?:\/\//, "")}</p>
          <ShareLink url={publicUrl} title={`Agende com ${business.name}`} />
        </div>
      </List>

      {birthdaysThisMonth.length > 0 && (
        <List header="Aniversariantes do mês">
          {birthdaysThisMonth.map((c) => (
            <Row
              key={c.id}
              href={`/painel/clientes/${c.id}`}
              leading={<Avatar name={c.name} size={32} />}
              title={c.name}
              detail={`${c.birthday!.slice(8, 10)}/${c.birthday!.slice(5, 7)}`}
              chevron
            />
          ))}
        </List>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3.5 py-3">
      <p className="text-[13px] font-medium text-label-2">{label}</p>
      <p className="mt-0.5 truncate text-[22px] font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
