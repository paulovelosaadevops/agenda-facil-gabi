import { useState } from "react";
import { PickerRow } from "@/components/picker-row";
import { ScreenHeader } from "@/components/screen-header";
import { timeOptions } from "@/components/time-select";
import { Banner, HeaderButton, Screen, Section } from "@/components/ui";
import { useBusiness } from "@/lib/auth";
import { useSaveBusiness } from "@/lib/use-save-business";

const withCurrent = (values: number[], current: number) =>
  values.includes(current) ? values : [...values, current].sort((a, b) => a - b);

const hours = (h: number) =>
  h === 0 ? "Nenhuma" : h === 1 ? "1 hora" : h % 24 || h < 24 ? `${h} horas` : h === 24 ? "1 dia" : `${h / 24} dias`;

export default function SchedulingSettings() {
  const b = useBusiness();
  const { save, saving, error } = useSaveBusiness();
  const [interval, setInterval] = useState(b.slot_interval_min);
  const [minAdvance, setMinAdvance] = useState(b.min_advance_hours);
  const [maxDays, setMaxDays] = useState(b.max_advance_days);
  const [reminder, setReminder] = useState(b.reminder_hours_before);
  const [buffer, setBuffer] = useState(b.buffer_min);
  const [latestEnd, setLatestEnd] = useState((b.latest_end_time ?? "20:30").slice(0, 5));

  return (
    <Screen>
      <ScreenHeader
        title="Agendamento"
        right={
          <HeaderButton
            title={saving ? "Salvando…" : "Salvar"}
            bold
            onPress={() =>
              save({
                slot_interval_min: interval,
                buffer_min: buffer,
                min_advance_hours: minAdvance,
                max_advance_days: maxDays,
                reminder_hours_before: reminder,
                latest_end_time: latestEnd,
              })
            }
          />
        }
      />
      {error && <Banner>{error}</Banner>}
      <Section footer="De quanto em quanto tempo os horários são oferecidos às clientes. Ex.: 30 min → 9:00, 9:30, 10:00.">
        <PickerRow
          label="Grade de horários"
          value={interval}
          onChange={setInterval}
          options={withCurrent([15, 20, 30, 45, 60], b.slot_interval_min).map((v) => ({ label: `${v} min`, value: v }))}
        />
      </Section>
      <Section footer="Tempo livre obrigatório depois de cada atendimento. Ex.: com 30 min, um serviço das 9:00 às 11:00 libera o próximo horário às 11:30.">
        <PickerRow
          label="Intervalo entre atendimentos"
          value={buffer}
          onChange={setBuffer}
          options={withCurrent([0, 10, 15, 20, 30, 45, 60], b.buffer_min).map((v) => ({ label: v ? `${v} min` : "Sem intervalo", value: v }))}
        />
      </Section>
      <Section footer="O expediente define os horários de início; o atendimento pode passar do fim dele, mas nunca termina depois deste horário. Ex.: tarde das 13:00 às 18:30 → último início às 18:00.">
        <PickerRow
          label="Terminar no máximo às"
          value={latestEnd}
          onChange={setLatestEnd}
          options={[...new Set([...timeOptions("17:00", "23:30", 30), latestEnd])].sort().map((v) => ({ label: v, value: v }))}
        />
      </Section>
      <Section footer="Evita agendamentos em cima da hora e muito distantes. Vale para as clientes; você pode encaixar quando quiser.">
        <PickerRow
          label="Antecedência mínima"
          value={minAdvance}
          onChange={setMinAdvance}
          options={withCurrent([0, 1, 2, 3, 6, 12, 24, 48], b.min_advance_hours).map((v) => ({ label: hours(v), value: v }))}
        />
        <PickerRow
          label="Agendar com até"
          value={maxDays}
          onChange={setMaxDays}
          options={withCurrent([7, 14, 30, 60, 90, 180], b.max_advance_days).map((v) => ({ label: `${v} dias`, value: v }))}
        />
      </Section>
      <Section footer="Enviado pelo WhatsApp antes de cada atendimento confirmado.">
        <PickerRow
          label="Lembrete"
          value={reminder}
          onChange={setReminder}
          options={withCurrent([2, 6, 12, 24, 48], b.reminder_hours_before).map((v) => ({ label: `${hours(v)} antes`, value: v }))}
        />
      </Section>
    </Screen>
  );
}
