"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, FormRow, List, RowInput, SwitchRow, iconButtonClass } from "@/components/ui";
import { addTimeOff, deleteTimeOff, type SettingsState } from "../actions";

export function NewTimeOffButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Novo bloqueio" className={iconButtonClass("tinted")} onClick={() => setOpen(true)}>
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Novo bloqueio">
        <TimeOffForm today={today} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function TimeOffForm({ today, onDone }: { today: string; onDone: () => void }) {
  const [state, action] = useActionState<SettingsState, FormData>(addTimeOff, undefined);
  const [allDay, setAllDay] = useState(true);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      <List>
        <SwitchRow label="Dia inteiro" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        <FormRow label="Início">
          <span className="flex justify-end gap-3">
            <RowInput name="start_date" type="date" required defaultValue={today} className="w-auto" />
            {!allDay && <RowInput name="start_time" type="time" required defaultValue="09:00" className="w-auto" />}
          </span>
        </FormRow>
        <FormRow label="Fim">
          <span className="flex justify-end gap-3">
            <RowInput name="end_date" type="date" required defaultValue={today} className="w-auto" />
            {!allDay && <RowInput name="end_time" type="time" required defaultValue="18:00" className="w-auto" />}
          </span>
        </FormRow>
      </List>
      <List footer="Nenhum horário será oferecido às clientes neste período.">
        <FormRow label="Motivo">
          <RowInput name="reason" placeholder="Férias, curso, consulta..." />
        </FormRow>
      </List>
      {state?.error && (
        <div className="mb-4">
          <Alert>{state.error}</Alert>
        </div>
      )}
      <SubmitButton>Bloquear período</SubmitButton>
    </form>
  );
}

export function DeleteTimeOffButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Remover bloqueio"
      disabled={pending}
      onClick={() => startTransition(() => deleteTimeOff(id))}
      className="rounded-full p-2 text-red transition hover:bg-red/10 disabled:opacity-40"
    >
      <Trash2 className="size-[18px]" />
    </button>
  );
}
