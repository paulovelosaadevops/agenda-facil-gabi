"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, FormRow, List, RowInput, TextAreaRow, buttonClass, iconButtonClass } from "@/components/ui";
import { formatPhone } from "@/lib/format";
import type { Client } from "@/lib/types";
import { saveClient, type ClientState } from "./actions";

function ClientForm({ client, onDone }: { client?: Client; onDone: () => void }) {
  const [state, action] = useActionState<ClientState, FormData>(saveClient, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={client?.id ?? ""} />
      <List>
        <FormRow label="Nome">
          <RowInput name="name" required defaultValue={client?.name} placeholder="Nome completo" autoComplete="off" />
        </FormRow>
        <FormRow label="WhatsApp">
          <RowInput name="phone" type="tel" required defaultValue={client ? formatPhone(client.phone) : ""} placeholder="(11) 99999-8888" />
        </FormRow>
        <FormRow label="E-mail">
          <RowInput name="email" type="email" defaultValue={client?.email ?? ""} placeholder="Opcional" />
        </FormRow>
        <FormRow label="Aniversário">
          <RowInput name="birthday" type="date" defaultValue={client?.birthday ?? ""} />
        </FormRow>
      </List>
      <List header="Observações" footer="Preferências, alergias, formato e cores favoritas.">
        <TextAreaRow name="notes" defaultValue={client?.notes} placeholder="Anotações sobre a cliente" />
      </List>
      {state?.error && (
        <div className="mb-4">
          <Alert>{state.error}</Alert>
        </div>
      )}
      <SubmitButton>{client ? "Salvar" : "Adicionar cliente"}</SubmitButton>
    </form>
  );
}

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Nova cliente" className={iconButtonClass("tinted")} onClick={() => setOpen(true)}>
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nova cliente">
        <ClientForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function EditClientButton({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass("plain", "md", "text-[17px] font-normal")} onClick={() => setOpen(true)}>
        <Pencil className="size-4 md:hidden" />
        <span className="max-md:sr-only">Editar</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Editar cliente">
        <ClientForm client={client} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
