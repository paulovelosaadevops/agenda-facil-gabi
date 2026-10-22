import { TZDate } from "@date-fns/tz";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { DateCalendar, DateField } from "@/components/date-calendar";
import { ScreenHeader } from "@/components/screen-header";
import { Segmented } from "@/components/segmented";
import { SlotChips } from "@/components/slot-chips";
import { Banner, Button, FormRow, HeaderButton, Input, Loading, Screen, Section, Text } from "@/components/ui";
import { dayBounds, parseDateKey, type Interval } from "@shared/availability.ts";
import { formatInTz } from "@shared/format.ts";
import { useBusiness } from "@/lib/auth";
import { dbErrorMessage, supabase } from "@/lib/supabase";
import { invalidate } from "@/lib/use-query";
import { useGridCells } from "@/lib/use-grid-cells";

const MODES = ["Dia inteiro", "Vários dias", "Horários"] as const;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Junta horários seguidos em um bloqueio só (09:00 + 09:30 → 09:00–10:00). */
function mergeCells(cells: Interval[]): Interval[] {
  const sorted = [...cells].sort((a, b) => a.start.getTime() - b.start.getTime());
  return sorted.reduce<Interval[]>((acc, c) => {
    const last = acc[acc.length - 1];
    if (last && last.end.getTime() === c.start.getTime()) last.end = c.end;
    else acc.push({ ...c });
    return acc;
  }, []);
}

/** Quantidade de dias de um período, contando o primeiro e o último. */
function daysBetween(from: string, to: string) {
  const [y1, m1, d1] = parseDateKey(from);
  const [y2, m2, d2] = parseDateKey(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000) + 1;
}

export default function NewTimeOff() {
  const router = useRouter();
  const business = useBusiness();
  const tz = business.timezone;
  // No computador, calendário à esquerda e detalhes à direita.
  const wide = useWindowDimensions().width >= 900;
  const today = useMemo(() => formatInTz(new Date(), "yyyy-MM-dd", tz), [tz]);
  const [day, setDay] = useState(today);
  const [until, setUntil] = useState<string>();
  const [mode, setMode] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const kind = MODES[mode];
  const byTime = kind === "Horários";
  const range = kind === "Vários dias";
  const dates = useMemo(() => [day], [day]);
  const { data } = useGridCells(business, dates);
  const cells = data?.[day];
  const booked = cells?.filter((c) => c.status === "booked").length ?? 0;
  const label = (key: string, pattern: string) => capitalize(formatInTz(dayBounds(key, tz).start, pattern, tz));
  const dayLabel = label(day, "EEEE, d 'de' MMMM 'de' yyyy");

  const changeDates = (start: string, end?: string) => {
    setError(undefined);
    setDay(start);
    setUntil(end);
    setPicked([]);
  };

  const changeMode = (index: number) => {
    setError(undefined);
    setMode(index);
    setUntil(undefined);
    setPicked([]);
  };

  const midnight = (date: string, offset = 0) => {
    const [y, m, d] = parseDateKey(date);
    return new Date(new TZDate(y, m - 1, d + offset, 0, 0, 0, tz).getTime());
  };

  const save = async () => {
    setError(undefined);
    let periods: Interval[];
    if (byTime) {
      periods = mergeCells((cells ?? []).filter((c) => picked.includes(c.label)));
      if (!periods.length) return setError("Toque nos horários que quer bloquear.");
    } else {
      if (range && !until) return setError("Toque no último dia do período.");
      periods = [{ start: midnight(day), end: midnight(range ? until! : day, 1) }];
    }
    setSaving(true);
    const { error: e } = await supabase.from("time_off").insert(
      periods.map((p) => ({ business_id: business.id, starts_at: p.start.toISOString(), ends_at: p.end.toISOString(), reason: reason.trim() })),
    );
    setSaving(false);
    if (e) return setError(dbErrorMessage(e));
    invalidate();
    router.back();
  };

  const buttonTitle = byTime
    ? picked.length
      ? `Bloquear ${picked.length} ${picked.length === 1 ? "horário" : "horários"}`
      : "Bloquear horários"
    : range
      ? until
        ? `Bloquear ${daysBetween(day, until)} dias`
        : "Bloquear período"
      : "Bloquear dia";

  const details = (
    <>
      {byTime ? (
        <View style={{ marginBottom: 24 }}>
          {wide && <Text variant="headline">{dayLabel}</Text>}
          <Text variant="footnote" color="label2" style={{ marginTop: 2, marginBottom: 12 }}>
            Toque nos horários que quer bloquear; os riscados já estão ocupados.
          </Text>
          {!cells ? (
            <Loading />
          ) : cells.length ? (
            <SlotChips
              slots={cells.map((c) => c.label)}
              selected={picked}
              disabled={cells.filter((c) => c.status !== "free").map((c) => c.label)}
              onSelect={(l) => setPicked((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]))}
            />
          ) : (
            <Banner tone="info">Nenhum horário de atendimento livre neste dia.</Banner>
          )}
        </View>
      ) : range ? (
        <Section
          footer={
            until
              ? "Nenhum horário desses dias será oferecido às clientes. Atendimentos já marcados continuam na agenda."
              : "No calendário, toque no primeiro e depois no último dia do período."
          }
        >
          <FormRow label="De">
            <Text color="label2">{label(day, "EEE, d 'de' MMM 'de' yyyy")}</Text>
          </FormRow>
          <FormRow label="Até">
            <Text color={until ? "label2" : "accent"}>{until ? label(until, "EEE, d 'de' MMM 'de' yyyy") : "Toque no último dia"}</Text>
          </FormRow>
          {until && (
            <FormRow label="Total">
              <Text color="label2">{daysBetween(day, until)} dias</Text>
            </FormRow>
          )}
        </Section>
      ) : (
        <Section
          footer={
            booked
              ? "Este dia já tem atendimento marcado. Ele continua na agenda; nenhum horário novo será oferecido."
              : "Nenhum horário deste dia será oferecido às clientes."
          }
        >
          <FormRow label="Dia">
            <Text color="label2">{dayLabel}</Text>
          </FormRow>
        </Section>
      )}

      <Section footer="Opcional. Só você vê.">
        <FormRow label="Motivo">
          <Input value={reason} onChangeText={setReason} placeholder="Consulta, curso, férias..." />
        </FormRow>
      </Section>

      {error && <Banner>{error}</Banner>}
      <Button title={buttonTitle} onPress={save} loading={saving} disabled={(byTime && !picked.length) || (range && !until)} />
    </>
  );

  return (
    <Screen>
      <ScreenHeader title="Bloquear" left={<HeaderButton icon="close" accessibilityLabel="Cancelar" onPress={() => router.back()} />} />

      <Segmented values={[...MODES]} selectedIndex={mode} onChange={changeMode} />

      <View style={wide ? { flexDirection: "row", gap: 32, alignItems: "flex-start" } : undefined}>
        <View style={wide ? { width: 400 } : { marginBottom: 24 }}>
          {/* Período precisa do mês aberto (início e fim); um dia só recolhe no celular. */}
          {range ? (
            <DateCalendar min={today} start={day} end={until} range onChange={changeDates} />
          ) : (
            <DateField min={today} today={today} value={day} label={dayLabel} collapsible={!wide} onChange={(d) => changeDates(d)} />
          )}
        </View>
        <View style={wide ? { flex: 1, minWidth: 0 } : undefined}>{details}</View>
      </View>
    </Screen>
  );
}
