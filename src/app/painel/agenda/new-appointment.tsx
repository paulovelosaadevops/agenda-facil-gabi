"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, FormRow, List, RowInput, RowSelect, SwitchRow, TextAreaRow, iconButtonClass } from "@/components/ui";
import { formatDuration, formatMoney } from "@/lib/format";
import type { Client, Service } from "@/lib/types";
import { createAppointment, suggestSlots, type AppointmentState } from "./actions";

interface Props {
  clients: Pick<Client, "id" | "name">[];
  services: Service[];
  defaultDate: string;
  initialOpen?: boolean;
  initialClientId?: string;
}

export function NewAppointmentButton(props: Props) {
  const [open, setOpen] = useState(Boolean(props.initialOpen));
  return (
    <>
      <button type="button" aria-label="Novo agendamento" className={iconButtonClass("tinted")} onClick={() => setOpen(true)}>
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Novo agendamento">
        <AppointmentForm {...props} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function AppointmentForm({ clients, services, defaultDate, initialClientId, onDone }: Props & { onDone: () => void }) {
  const [state, action] = useActionState<AppointmentState, FormData>(createAppointment, undefined);
  const [newClient, setNewClient] = useState(clients.length === 0);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>();
  const [loadingSlots, startLoading] = useTransition();

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  useEffect(() => {
    if (!serviceId || !date) return;
    startLoading(async () => setSlots(await suggestSlots(serviceId, date)));
  }, [serviceId, date]);

  return (
    <form action={action}>
      <List
        header="Cliente"
        footer={
          clients.length > 0 && (
            <button type="button" className="text-accent" onClick={() => setNewClient(!newClient)}>
              {newClient ? "Escolher cliente cadastrada" : "Cadastrar nova cliente"}
            </button>
          )
        }
      >
        {newClient ? (
          <>
            <FormRow label="Nome">
              <RowInput name="new_client_name" required placeholder="Nome da cliente" autoComplete="off" />
            </FormRow>
            <FormRow label="WhatsApp">
              <RowInput name="new_client_phone" type="tel" required placeholder="(11) 99999-8888" />
            </FormRow>
          </>
        ) : (
          <FormRow label="Cliente">
            <RowSelect name="client_id" required defaultValue={initialClientId ?? ""}>
              <option value="" disabled>
                Escolher
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </RowSelect>
          </FormRow>
        )}
      </List>

      <List header="Serviço">
        <FormRow label="Serviço">
          <RowSelect name="service_id" required value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="" disabled>
              Escolher
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatDuration(s.duration_min)} · {formatMoney(s.price_cents)}
              </option>
            ))}
          </RowSelect>
        </FormRow>
      </List>

      <List header="Quando">
        <FormRow label="Data">
          <RowInput name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>
        <FormRow label="Horário">
          <RowInput name="time" type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} />
        </FormRow>
      </List>

      {serviceId && (
        <section className="-mt-4 mb-7">
          <p className="px-4 pb-2 text-[13px] text-label-2">
            {loadingSlots ? "Buscando horários livres..." : slots?.length ? "Horários livres" : "Nenhum horário livre no expediente deste dia"}
          </p>
          {!!slots?.length && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTime(s)}
                  className={clsx(
                    "h-9 rounded-[10px] text-[15px] font-medium tabular-nums transition active:scale-95",
                    time === s ? "bg-accent-strong text-accent-fg" : "bg-surface",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <List>
        <TextAreaRow name="notes" placeholder="Observações" className="min-h-16" />
        <SwitchRow name="notify" defaultChecked label="Confirmar no WhatsApp" />
      </List>

      {state?.error && (
        <div className="mb-4">
          <Alert>{state.error}</Alert>
        </div>
      )}
      <SubmitButton pendingText="Agendando...">Agendar</SubmitButton>
    </form>
  );
}
