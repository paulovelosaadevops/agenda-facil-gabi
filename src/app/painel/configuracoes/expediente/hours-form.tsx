"use client";

import clsx from "clsx";
import { useState } from "react";
import { List, Switch } from "@/components/ui";
import type { WorkingHours } from "@/lib/types";

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
// Começa na segunda, como a maioria das agendas brasileiras.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const t = (v?: string) => v?.slice(0, 5) ?? "";

// Seletor 24h de 15 em 15 min: igual em qualquer navegador e abre a roleta no iPhone.
const TIMES = Array.from({ length: (23 - 5) * 4 + 1 }, (_, i) => {
  const minutes = 5 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function TimeInput(props: { name: string; defaultValue: string; label: string; optional?: boolean }) {
  const options = props.defaultValue && !TIMES.includes(props.defaultValue) ? [...TIMES, props.defaultValue].sort() : TIMES;
  return (
    <select
      aria-label={props.label}
      name={props.name}
      defaultValue={props.defaultValue}
      className="h-8 w-[4.75rem] cursor-pointer appearance-none rounded-lg bg-fill text-center text-[16px] tabular-nums outline-none [text-align-last:center] focus:ring-2 focus:ring-accent/40 md:text-[15px]"
    >
      {props.optional && <option value="">––:––</option>}
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

/** Um bloco por dia: switch para abrir/fechar e até dois períodos (ex.: antes e depois do almoço). */
export function HoursFields({ hours }: { hours: WorkingHours[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(ORDER.map((d) => [d, hours.some((h) => h.weekday === d)])),
  );

  return (
    <List footer="Use o segundo período para separar o horário de almoço. Deixe em branco se não precisar.">
      {ORDER.map((weekday) => {
        const day = hours.filter((h) => h.weekday === weekday).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const isOpen = open[weekday];
        return (
          <div
            key={weekday}
            className="relative px-4 py-2.5 after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-separator last:after:hidden"
          >
            <label className="flex min-h-7 cursor-pointer items-center justify-between gap-3">
              <span className="text-[16px] md:text-[15px]">{WEEKDAYS[weekday]}</span>
              <span className="flex items-center gap-3">
                {!isOpen && <span className="text-[15px] text-label-2">Fechado</span>}
                <Switch
                  name={`open_${weekday}`}
                  checked={isOpen}
                  onChange={(e) => setOpen((o) => ({ ...o, [weekday]: e.target.checked }))}
                />
              </span>
            </label>
            {/* Fica montado (só escondido) para não perder os horários ao desligar e religar. */}
            <div className={clsx("mt-2.5 space-y-2", !isOpen && "hidden")}>
              {[1, 2].map((slot) => (
                <div key={slot} className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-label-2">{slot === 1 ? "Período" : "2º período"}</span>
                  <span className="flex items-center gap-1.5">
                    <TimeInput
                      name={`start${slot}_${weekday}`}
                      defaultValue={t(day[slot - 1]?.start_time) || (slot === 1 ? "09:00" : "")}
                      label="Início"
                      optional={slot === 2}
                    />
                    <span className="text-label-3">–</span>
                    <TimeInput
                      name={`end${slot}_${weekday}`}
                      defaultValue={t(day[slot - 1]?.end_time) || (slot === 1 ? "18:00" : "")}
                      label="Fim"
                      optional={slot === 2}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </List>
  );
}
