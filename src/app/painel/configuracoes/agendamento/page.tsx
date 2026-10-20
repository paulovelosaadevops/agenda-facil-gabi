import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { FormRow, List, RowSelect } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { saveScheduling } from "../actions";
import { SettingsForm } from "../settings-form";

export const metadata: Metadata = { title: "Regras de agendamento" };

function withCurrent(values: number[], current: number) {
  return values.includes(current) ? values : [...values, current].sort((a, b) => a - b);
}

const hours = (h: number) => (h === 0 ? "Nenhuma" : h === 1 ? "1 hora" : h < 24 || h % 24 ? `${h} horas` : h === 24 ? "1 dia" : `${h / 24} dias`);

export default async function SchedulingPage() {
  const { business: b } = await requireBusiness();
  return (
    <>
      <PageHeader title="Agendamento" back={{ href: "/painel/configuracoes", label: "Ajustes" }} />
      <SettingsForm action={saveScheduling}>
        <List footer="De quanto em quanto tempo os horários são oferecidos às clientes. Ex.: 30 min → 9:00, 9:30, 10:00.">
          <FormRow label="Intervalo">
            <RowSelect name="slot_interval_min" defaultValue={b.slot_interval_min}>
              {withCurrent([15, 20, 30, 45, 60], b.slot_interval_min).map((v) => (
                <option key={v} value={v}>
                  {v} min
                </option>
              ))}
            </RowSelect>
          </FormRow>
        </List>
        <List footer="Evita agendamentos em cima da hora e muito distantes. Vale para o link e para a atendente virtual.">
          <FormRow label="Antecedência mínima">
            <RowSelect name="min_advance_hours" defaultValue={b.min_advance_hours}>
              {withCurrent([0, 1, 2, 3, 6, 12, 24, 48], b.min_advance_hours).map((v) => (
                <option key={v} value={v}>
                  {hours(v)}
                </option>
              ))}
            </RowSelect>
          </FormRow>
          <FormRow label="Agendar com até">
            <RowSelect name="max_advance_days" defaultValue={b.max_advance_days}>
              {withCurrent([7, 14, 30, 60, 90, 180], b.max_advance_days).map((v) => (
                <option key={v} value={v}>
                  {v} dias
                </option>
              ))}
            </RowSelect>
          </FormRow>
        </List>
        <List footer="Enviado pelo WhatsApp antes de cada atendimento confirmado.">
          <FormRow label="Lembrete">
            <RowSelect name="reminder_hours_before" defaultValue={b.reminder_hours_before}>
              {withCurrent([2, 6, 12, 24, 48], b.reminder_hours_before).map((v) => (
                <option key={v} value={v}>
                  {hours(v)} antes
                </option>
              ))}
            </RowSelect>
          </FormRow>
        </List>
      </SettingsForm>
    </>
  );
}
