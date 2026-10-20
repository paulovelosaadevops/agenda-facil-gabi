"use client";

import { Plus, Tag } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, EmptyState, FormRow, List, Row, RowInput, RowSelect, SwitchRow, TextAreaRow, iconButtonClass } from "@/components/ui";
import { formatDuration, formatMoney } from "@/lib/format";
import type { Service } from "@/lib/types";
import { saveService, type ServiceState } from "./actions";

const DURATIONS = [15, 20, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 210, 240];

function ServiceForm({ service, onDone }: { service?: Service; onDone: () => void }) {
  const [state, action] = useActionState<ServiceState, FormData>(saveService, undefined);
  const durations = service && !DURATIONS.includes(service.duration_min) ? [...DURATIONS, service.duration_min].sort((a, b) => a - b) : DURATIONS;

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={service?.id ?? ""} />
      <List>
        <FormRow label="Nome">
          <RowInput name="name" required defaultValue={service?.name} placeholder="Ex.: Blindagem" autoComplete="off" />
        </FormRow>
        <FormRow label="Duração">
          <RowSelect name="duration_min" defaultValue={service?.duration_min ?? 60}>
            {durations.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </RowSelect>
        </FormRow>
        <FormRow label="Preço">
          <RowInput
            name="price"
            inputMode="decimal"
            placeholder="R$ 0,00"
            defaultValue={service ? (service.price_cents / 100).toFixed(2).replace(".", ",") : ""}
          />
        </FormRow>
      </List>
      <List header="Descrição" footer="A atendente virtual usa este texto para tirar dúvidas das clientes.">
        <TextAreaRow name="description" defaultValue={service?.description} placeholder="O que está incluso, cuidados, durabilidade..." />
      </List>
      <List>
        <SwitchRow name="active" defaultChecked={service?.active ?? true} label="Disponível para agendamento" />
      </List>
      {state?.error && (
        <div className="mb-4">
          <Alert>{state.error}</Alert>
        </div>
      )}
      <SubmitButton>{service ? "Salvar" : "Adicionar serviço"}</SubmitButton>
    </form>
  );
}

export function NewServiceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Novo serviço" className={iconButtonClass("tinted")} onClick={() => setOpen(true)}>
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Novo serviço">
        <ServiceForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function ServiceList({ services }: { services: Service[] }) {
  const [editingId, setEditingId] = useState<string>();
  const editing = services.find((s) => s.id === editingId);
  const active = services.filter((s) => s.active);
  const inactive = services.filter((s) => !s.active);

  if (!services.length) {
    return (
      <EmptyState icon={<Tag className="size-10" strokeWidth={1.5} />} title="Nenhum serviço">
        Toque em + para cadastrar o primeiro.
      </EmptyState>
    );
  }

  const row = (s: Service) => (
    <Row
      key={s.id}
      onClick={() => setEditingId(s.id)}
      title={s.name}
      subtitle={formatDuration(s.duration_min)}
      detail={formatMoney(s.price_cents)}
      tone={s.active ? "default" : "muted"}
      chevron
    />
  );

  return (
    <>
      {active.length > 0 && (
        <List footer="As clientes veem estes serviços no link de agendamento e no WhatsApp.">{active.map(row)}</List>
      )}
      {inactive.length > 0 && <List header="Indisponíveis">{inactive.map(row)}</List>}
      <Sheet open={Boolean(editing)} onClose={() => setEditingId(undefined)} title="Editar serviço">
        {editing && <ServiceForm service={editing} onDone={() => setEditingId(undefined)} />}
      </Sheet>
    </>
  );
}
