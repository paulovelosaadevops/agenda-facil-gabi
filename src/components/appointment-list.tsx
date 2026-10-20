"use client";

import clsx from "clsx";
import { Ban, Check, MessageCircle, RotateCcw, User, UserX } from "lucide-react";
import { useState, useTransition } from "react";
import { updateAppointmentStatus } from "@/app/painel/agenda/actions";
import { formatDuration, formatInTz, formatMoney } from "@/lib/format";
import { STATUS_LABEL, type AppointmentStatus, type AppointmentWithRefs } from "@/lib/types";
import { Sheet } from "./sheet";
import { SOURCE_LABEL, STATUS_TONE } from "./status";
import { Alert, List, Row, RowIcon } from "./ui";

/** Lista de agendamentos; tocar em um abre os detalhes e as ações. */
export function AppointmentList({ appointments, timeZone }: { appointments: AppointmentWithRefs[]; timeZone: string }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = appointments.find((a) => a.id === selectedId);

  return (
    <>
      <div className="overflow-hidden rounded-xl bg-surface">
        {appointments.map((a) => {
          const inactive = a.status === "cancelled" || a.status === "no_show";
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedId(a.id)}
              className="relative flex w-full items-stretch gap-3 py-3 pr-4 pl-4 text-left transition-colors after:absolute after:right-0 after:bottom-0 after:left-[5.25rem] after:h-px after:bg-separator last:after:hidden hover:bg-fill-2 active:bg-fill"
            >
              <span className="w-12 shrink-0 pt-px tabular-nums">
                <span className="block text-[15px] font-semibold">{formatInTz(a.starts_at, "HH:mm", timeZone)}</span>
                <span className="block text-[13px] text-label-2">{formatInTz(a.ends_at, "HH:mm", timeZone)}</span>
              </span>
              <span className={clsx("w-[3px] shrink-0 rounded-full", STATUS_TONE[a.status].bar)} aria-hidden />
              <span className={clsx("min-w-0 flex-1", inactive && "opacity-50")}>
                <span className={clsx("block truncate text-[16px] font-medium md:text-[15px]", a.status === "cancelled" && "line-through")}>
                  {a.clients?.name ?? "Cliente"}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-label-2">
                  {a.services?.name} · {formatMoney(a.price_cents)}
                </span>
              </span>
              {a.status !== "confirmed" && (
                <span className={clsx("shrink-0 self-center text-[12px] font-medium", STATUS_TONE[a.status].text)}>
                  {STATUS_LABEL[a.status]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Sheet open={Boolean(selected)} onClose={() => setSelectedId(undefined)} title="Agendamento">
        {selected && <AppointmentDetail appt={selected} timeZone={timeZone} onDone={() => setSelectedId(undefined)} />}
      </Sheet>
    </>
  );
}

function AppointmentDetail({ appt, timeZone, onDone }: { appt: AppointmentWithRefs; timeZone: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const active = appt.status === "pending" || appt.status === "confirmed";

  const setStatus = (status: AppointmentStatus) =>
    startTransition(async () => {
      const result = await updateAppointmentStatus(appt.id, status);
      if (result.error) setError(result.error);
      else onDone();
    });

  return (
    <div className={clsx(pending && "pointer-events-none opacity-60")}>
      <div className="mb-6 pt-2 text-center">
        <p className="text-[22px] font-bold tracking-tight">{appt.clients?.name}</p>
        <p className="mt-1 text-[15px] text-label-2">{appt.services?.name}</p>
        <p className="mt-3 text-[15px] font-medium first-letter:uppercase">
          {formatInTz(appt.starts_at, "EEEE, d 'de' MMMM", timeZone)}
        </p>
        <p className="text-[15px] text-label-2 tabular-nums">
          {formatInTz(appt.starts_at, "HH:mm", timeZone)} – {formatInTz(appt.ends_at, "HH:mm", timeZone)}
          {appt.services && ` · ${formatDuration(appt.services.duration_min)}`}
        </p>
      </div>

      <List>
        <Row title="Status" detail={<span className={STATUS_TONE[appt.status].text}>{STATUS_LABEL[appt.status]}</span>} />
        <Row title="Valor" detail={formatMoney(appt.price_cents)} />
        <Row title="Origem" detail={SOURCE_LABEL[appt.source]} />
        {appt.notes && <Row title={<span className="whitespace-normal">{appt.notes}</span>} tone="muted" />}
      </List>

      {appt.clients && (
        <List>
          <Row
            href={`https://wa.me/${appt.clients.phone}`}
            external
            leading={<RowIcon color="#25d366"><MessageCircle className="size-[18px]" /></RowIcon>}
            title="Enviar mensagem"
            chevron
          />
          <Row
            href={`/painel/clientes/${appt.clients.id}`}
            leading={<RowIcon color="#8e8e93"><User className="size-[18px]" /></RowIcon>}
            title="Ver cliente"
            chevron
          />
        </List>
      )}

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <List>
        {active ? (
          <>
            <Row
              onClick={() => setStatus("completed")}
              leading={<RowIcon color="#34c759"><Check className="size-[18px]" strokeWidth={2.5} /></RowIcon>}
              title="Concluir atendimento"
            />
            <Row
              onClick={() => setStatus("no_show")}
              leading={<RowIcon color="#ff9500"><UserX className="size-[18px]" /></RowIcon>}
              title="Cliente não compareceu"
            />
            <Row
              onClick={() => setStatus("cancelled")}
              leading={<RowIcon color="#ff3b30"><Ban className="size-[18px]" /></RowIcon>}
              title="Cancelar agendamento"
              tone="destructive"
            />
          </>
        ) : (
          <Row
            onClick={() => setStatus("confirmed")}
            leading={<RowIcon color="#007aff"><RotateCcw className="size-[18px]" /></RowIcon>}
            title="Reabrir agendamento"
          />
        )}
      </List>
    </div>
  );
}
