import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { dayBounds, toDateKey } from "@/lib/availability";
import { formatInTz } from "@/lib/format";

const LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Faixa da semana, como no Calendário do iPhone. Bolinha = dia com agendamentos. */
export function WeekStrip({
  date,
  today,
  timeZone,
  busyDays,
}: {
  date: string;
  today: string;
  timeZone: string;
  busyDays: Set<string>;
}) {
  const noon = new Date(dayBounds(date, timeZone).start.getTime() + 12 * 3_600_000);
  const weekday = new TZDate(noon.getTime(), timeZone).getDay();
  const sunday = addDays(noon, -weekday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  const prevWeek = toDateKey(addDays(noon, -7), timeZone);
  const nextWeek = toDateKey(addDays(noon, 7), timeZone);

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[17px] font-semibold first-letter:uppercase">{formatInTz(noon, "MMMM 'de' yyyy", timeZone)}</p>
        <div className="flex gap-1">
          <Link href={`?data=${prevWeek}`} replace scroll={false} aria-label="Semana anterior" className="rounded-full p-1.5 text-accent hover:bg-fill-2">
            <ChevronLeft className="size-5" strokeWidth={2.25} />
          </Link>
          <Link href={`?data=${nextWeek}`} replace scroll={false} aria-label="Próxima semana" className="rounded-full p-1.5 text-accent hover:bg-fill-2">
            <ChevronRight className="size-5" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-7 rounded-xl bg-surface px-1 py-2">
        {days.map((d, i) => {
          const key = toDateKey(d, timeZone);
          const selected = key === date;
          const isToday = key === today;
          return (
            <Link
              key={key}
              href={`?data=${key}`}
              replace
              scroll={false}
              aria-label={formatInTz(d, "EEEE, d 'de' MMMM", timeZone)}
              aria-current={selected ? "date" : undefined}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[11px] font-medium text-label-2">{LETTERS[i]}</span>
              <span
                className={clsx(
                  "flex size-9 items-center justify-center rounded-full text-[17px] tabular-nums transition",
                  selected && isToday && "bg-accent-strong font-semibold text-accent-fg",
                  selected && !isToday && "bg-label font-semibold text-bg",
                  !selected && isToday && "font-semibold text-accent",
                  !selected && "hover:bg-fill-2",
                )}
              >
                {formatInTz(d, "d", timeZone)}
              </span>
              <span className={clsx("size-[5px] rounded-full", busyDays.has(key) ? "bg-label-3" : "bg-transparent")} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
