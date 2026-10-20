"use client";

import clsx from "clsx";
import { CalendarPlus, Check, ChevronLeft } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, FormRow, List, Row, RowInput, TextAreaRow, buttonClass } from "@/components/ui";
import { formatDuration, formatInTz, formatMoney } from "@/lib/format";
import type { Service } from "@/lib/types";
import { book, fetchSlots } from "./actions";

interface Day {
  key: string; // YYYY-MM-DD
  weekday: string;
  day: string;
  month: string;
}

type PublicService = Pick<Service, "id" | "name" | "description" | "duration_min" | "price_cents">;
type Step = "service" | "time" | "details" | "done";

const PERIODS = [
  { label: "Manhã", test: (h: number) => h < 12 },
  { label: "Tarde", test: (h: number) => h >= 12 && h < 18 },
  { label: "Noite", test: (h: number) => h >= 18 },
];

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function downloadIcs(opts: { start: Date; minutes: number; title: string; location?: string | null }) {
  const end = new Date(opts.start.getTime() + opts.minutes * 60_000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agenda Facil//PT-BR",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@agenda-facil`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(opts.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${opts.title.replace(/[,;]/g, " ")}`,
    opts.location ? `LOCATION:${opts.location.replace(/[,;]/g, " ")}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "agendamento.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BookingFlow({
  slug,
  businessName,
  address,
  services,
  days,
  timeZone,
}: {
  slug: string;
  businessName: string;
  address: string | null;
  services: PublicService[];
  days: Day[];
  timeZone: string;
}) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<PublicService>();
  const [day, setDay] = useState(days[0]?.key);
  const [slots, setSlots] = useState<string[]>();
  const [slot, setSlot] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const loadSlots = (serviceId: string, date: string) => {
    setDay(date);
    setSlot(undefined);
    setSlots(undefined);
    setError(undefined);
    startTransition(async () => {
      const result = await fetchSlots(slug, serviceId, date);
      if (result.error) setError(result.error);
      setSlots(result.slots ?? []);
    });
  };

  const submit = (form: FormData) => {
    if (!service || !slot) return;
    setError(undefined);
    startTransition(async () => {
      const result = await book(slug, {
        serviceId: service.id,
        startsAt: slot,
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        notes: String(form.get("notes") ?? ""),
      });
      if (result.ok) {
        setStep("done");
        window.scrollTo({ top: 0 });
      } else {
        setError(result.error);
        // O horário pode ter sido ocupado por outra pessoa: volta para escolher de novo.
        if (day) {
          loadSlots(service.id, day);
          setStep("time");
        }
      }
    });
  };

  const back = () => setStep(step === "details" ? "time" : "service");

  if (step === "done" && service && slot) {
    return (
      <div className="flex flex-col items-center pt-10 text-center">
        <span className="animate-pop-in flex size-20 items-center justify-center rounded-full bg-green-bright text-white">
          <Check className="size-11" strokeWidth={3} />
        </span>
        <h1 className="mt-6 text-[28px] font-bold tracking-tight">Tudo certo!</h1>
        <p className="mt-1 text-[17px] text-label-2">Seu horário está confirmado.</p>

        <div className="mt-8 w-full rounded-2xl bg-surface p-5 text-left">
          <p className="text-[13px] font-semibold text-label-2 uppercase">{businessName}</p>
          <p className="mt-2 text-[20px] font-semibold">{service.name}</p>
          <p className="mt-1 text-[17px] first-letter:uppercase">{formatInTz(slot, "EEEE, d 'de' MMMM", timeZone)}</p>
          <p className="text-[17px] text-label-2 tabular-nums">
            {formatInTz(slot, "HH:mm", timeZone)} · {formatDuration(service.duration_min)}
          </p>
          {address && <p className="mt-3 text-[15px] text-label-2">{address}</p>}
        </div>

        <button
          type="button"
          onClick={() => downloadIcs({ start: new Date(slot), minutes: service.duration_min, title: `${service.name} · ${businessName}`, location: address })}
          className={buttonClass("tinted", "lg", "mt-4 w-full")}
        >
          <CalendarPlus className="size-5" />
          Adicionar ao Calendário
        </button>
        <p className="mt-6 text-[13px] text-label-2">Você vai receber a confirmação e um lembrete no WhatsApp.</p>
      </div>
    );
  }

  const groups = PERIODS.map((p) => ({
    label: p.label,
    slots: (slots ?? []).filter((s) => p.test(Number(formatInTz(s, "H", timeZone)))),
  })).filter((g) => g.slots.length);
  const selectedDay = days.find((d) => d.key === day);

  return (
    <div>
      <div className="mb-2 h-8">
        {step !== "service" && (
          <button type="button" onClick={back} className="-ml-2 flex items-center text-[17px] text-accent active:opacity-60">
            <ChevronLeft className="size-7" strokeWidth={2} />
            Voltar
          </button>
        )}
      </div>

      {step === "service" && (
        <section className="animate-fade-in">
          <h1 className="mb-5 text-[28px] font-bold tracking-tight">Escolha o serviço</h1>
          <List>
            {services.map((s) => (
              <Row
                key={s.id}
                onClick={() => {
                  setService(s);
                  setStep("time");
                  loadSlots(s.id, day ?? days[0].key);
                }}
                title={<span className="font-medium">{s.name}</span>}
                subtitle={s.description ? `${formatDuration(s.duration_min)} · ${s.description}` : formatDuration(s.duration_min)}
                detail={formatMoney(s.price_cents)}
                chevron
              />
            ))}
          </List>
        </section>
      )}

      {step === "time" && service && (
        <section className="animate-fade-in">
          <h1 className="text-[28px] font-bold tracking-tight">Escolha o horário</h1>
          <p className="mt-1 mb-5 text-[15px] text-label-2">
            {service.name} · {formatDuration(service.duration_min)} · {formatMoney(service.price_cents)}
          </p>

          <p className="mb-2 text-[15px] font-semibold first-letter:uppercase">{selectedDay?.month}</p>
          <div className="no-scrollbar -mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1">
            {days.map((d) => {
              const selected = d.key === day;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => loadSlots(service.id, d.key)}
                  aria-pressed={selected}
                  className={clsx(
                    "flex h-[68px] w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl transition active:scale-95",
                    selected ? "bg-accent-strong text-accent-fg" : "bg-surface",
                  )}
                >
                  <span className={clsx("text-[12px] font-medium uppercase", selected ? "text-accent-fg/85" : "text-label-2")}>{d.weekday}</span>
                  <span className="text-[20px] font-semibold tabular-nums">{d.day}</span>
                </button>
              );
            })}
          </div>

          {pending && !slots ? (
            <div className="grid grid-cols-4 gap-2" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : groups.length ? (
            groups.map((g) => (
              <div key={g.label} className="mb-5">
                <p className="mb-2 text-[13px] font-medium text-label-2 uppercase">{g.label}</p>
                <div className="grid grid-cols-4 gap-2">
                  {g.slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSlot(s);
                        setStep("details");
                        window.scrollTo({ top: 0 });
                      }}
                      className="h-11 rounded-xl bg-surface text-[16px] font-medium tabular-nums transition hover:ring-2 hover:ring-accent/40 active:scale-95"
                    >
                      {formatInTz(s, "HH:mm", timeZone)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-surface px-4 py-8 text-center text-[15px] text-label-2">
              Sem horários livres neste dia.
              <br />
              Tente outro dia.
            </p>
          )}
          {error && <Alert>{error}</Alert>}
        </section>
      )}

      {step === "details" && service && slot && (
        <section className="animate-fade-in">
          <h1 className="mb-5 text-[28px] font-bold tracking-tight">Seus dados</h1>
          <div className="mb-7 rounded-2xl bg-surface p-4">
            <p className="text-[17px] font-semibold">{service.name}</p>
            <p className="mt-0.5 text-[15px] text-label-2 first-letter:uppercase">
              {formatInTz(slot, "EEEE, d 'de' MMMM 'às' HH:mm", timeZone)}
            </p>
          </div>
          <form action={submit}>
            <List footer="Enviaremos a confirmação e um lembrete por WhatsApp.">
              <FormRow label="Nome">
                <RowInput name="name" required autoComplete="name" placeholder="Seu nome" />
              </FormRow>
              <FormRow label="WhatsApp">
                <RowInput name="phone" type="tel" required autoComplete="tel" placeholder="(11) 99999-8888" />
              </FormRow>
            </List>
            <List header="Observações">
              <TextAreaRow name="notes" placeholder="Ideia de cor, referência, alguma alergia... (opcional)" className="min-h-20" />
            </List>
            {error && (
              <div className="mb-4">
                <Alert>{error}</Alert>
              </div>
            )}
            <button type="submit" disabled={pending} className={buttonClass("filled", "lg", "w-full")}>
              {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {pending ? "Agendando..." : "Confirmar agendamento"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
