import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { timeOptions, TimeSelect } from "@/components/time-select";
import { Icon } from "@/components/icon";
import { Banner, HeaderButton, Loading, Screen, Switch, tap, Text } from "@/components/ui";
import type { WorkingHours } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { dbErrorMessage, supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { invalidate, useQuery } from "@/lib/use-query";

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // começa na segunda
const HOURS = timeOptions("06:00", "23:30", 30);
const MAX_PERIODS = 3; // manhã, tarde e noite
type Period = [string, string];
type Day = { open: boolean; periods: Period[] };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** Nome do período pelo horário de início. */
const periodName = (start: string) => (toMin(start) < 12 * 60 ? "Manhã" : toMin(start) < 18 * 60 ? "Tarde" : "Noite");
const sorted = (periods: Period[]) => [...periods].sort((a, b) => a[0].localeCompare(b[0]));

/** Problema nos períodos de um dia (fim antes do início ou sobreposição), ou undefined. */
function problem(periods: Period[]): string | undefined {
  const list = sorted(periods);
  for (const [start, end] of list) if (toMin(end) <= toMin(start)) return `o período das ${start} termina antes de começar`;
  for (let i = 1; i < list.length; i++) {
    if (toMin(list[i][0]) < toMin(list[i - 1][1])) return `os períodos das ${list[i - 1][0]} e das ${list[i][0]} se sobrepõem`;
  }
}

export default function WorkingHoursSettings() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const [days, setDays] = useState<Record<number, Day>>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);

  useQuery(async () => {
    const { data } = await supabase.from("working_hours").select("*").eq("business_id", business.id).returns<WorkingHours[]>();
    const next: Record<number, Day> = {};
    for (const d of ORDER) {
      const periods = sorted(
        (data ?? []).filter((h) => h.weekday === d).map((h) => [h.start_time.slice(0, 5), h.end_time.slice(0, 5)] as Period),
      );
      next[d] = { open: periods.length > 0, periods: periods.length ? periods : [["09:00", "18:00"]] };
    }
    setDays(next);
    return null;
  });

  const update = (weekday: number, fn: (d: Day) => Day) => {
    setNotice(undefined);
    setDays((all) => (all ? { ...all, [weekday]: fn(all[weekday]) } : all));
  };

  /** Próximo período sugerido: 1h depois do último, com 3h de duração (até 23:30). */
  const nextPeriod = (periods: Period[]): Period | undefined => {
    const lastEnd = Math.max(...periods.map((p) => toMin(p[1])));
    const start = lastEnd + 60;
    if (start > toMin("22:30")) return undefined;
    return [toTime(start), toTime(Math.min(start + 180, toMin("23:30")))];
  };

  const copyToOthers = (weekday: number) => {
    if (!days) return;
    tap();
    const source = days[weekday];
    const next = { ...days };
    for (const d of ORDER) if (d !== weekday && next[d].open) next[d] = { open: true, periods: source.periods.map((p) => [...p] as Period) };
    setDays(next);
    setNotice(`Horário de ${WEEKDAYS[weekday].toLowerCase()} copiado para os outros dias abertos.`);
  };

  const save = async () => {
    if (!days) return;
    for (const weekday of ORDER) {
      const issue = days[weekday].open ? problem(days[weekday].periods) : undefined;
      if (issue) return setError(`${WEEKDAYS[weekday]}: ${issue}.`);
    }
    const rows = ORDER.flatMap((weekday) =>
      days[weekday].open ? sorted(days[weekday].periods).map(([start, end]) => ({ business_id: business.id, weekday, start_time: start, end_time: end })) : [],
    );
    setSaving(true);
    setError(undefined);
    const del = await supabase.from("working_hours").delete().eq("business_id", business.id);
    const ins = del.error ? del : rows.length ? await supabase.from("working_hours").insert(rows) : del;
    setSaving(false);
    if (ins.error) return setError(dbErrorMessage(ins.error));
    invalidate();
    router.back();
  };

  return (
    <Screen>
      <ScreenHeader title="Expediente" right={<HeaderButton title={saving ? "Salvando…" : "Salvar"} bold onPress={save} />} />
      {error && <Banner>{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}
      {!days ? (
        <Loading />
      ) : (
        <>
          <Text variant="footnote" color="label2" style={styles.intro}>
            Dias e horários em que você atende. Use até 3 períodos por dia (manhã, tarde e noite); o intervalo entre eles fica livre,
            como o almoço.
          </Text>
          {ORDER.map((weekday) => {
            const day = days[weekday];
            const suggestion = nextPeriod(day.periods);
            const setPeriod = (i: number, k: 0 | 1, v: string) =>
              update(weekday, (d) => ({ ...d, periods: d.periods.map((p, j) => (j === i ? ((k === 0 ? [v, p[1]] : [p[0], v]) as Period) : p)) }));
            const issue = day.open ? problem(day.periods) : undefined;
            return (
              <View key={weekday} style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.cardHeader}>
                  <Text variant="headline" style={{ flex: 1 }}>
                    {WEEKDAYS[weekday]}
                  </Text>
                  {!day.open && (
                    <Text variant="subhead" color="label2">
                      Fechado
                    </Text>
                  )}
                  <Switch value={day.open} onValueChange={(open) => update(weekday, (d) => ({ ...d, open }))} accessibilityLabel={WEEKDAYS[weekday]} />
                </View>
                {day.open && (
                  <>
                    {day.periods.map(([start, end], i) => (
                      <View key={i} style={[styles.period, { borderTopColor: theme.separator }]}>
                        <Text color="label2" style={styles.periodLabel}>
                          {periodName(start)}
                        </Text>
                        <TimeSelect value={start} onChange={(v) => setPeriod(i, 0, v)} title={`${periodName(start)}: início`} options={HOURS} />
                        <Text color="label3">às</Text>
                        <TimeSelect value={end} onChange={(v) => setPeriod(i, 1, v)} title={`${periodName(start)}: fim`} options={HOURS} />
                        {day.periods.length > 1 && (
                          <Pressable
                            hitSlop={10}
                            accessibilityLabel={`Remover período das ${start}`}
                            onPress={() => update(weekday, (d) => ({ ...d, periods: d.periods.filter((_, j) => j !== i) }))}
                            style={{ marginLeft: "auto" }}
                          >
                            <Icon name="close" size={18} color={theme.label3} />
                          </Pressable>
                        )}
                      </View>
                    ))}
                    {issue && (
                      <Text variant="footnote" color="red" style={styles.issue}>
                        Ajuste: {issue}.
                      </Text>
                    )}
                    <View style={[styles.actions, { borderTopColor: theme.separator }]}>
                      {day.periods.length < MAX_PERIODS && suggestion ? (
                        <Pressable hitSlop={8} onPress={() => update(weekday, (d) => ({ ...d, periods: sorted([...d.periods, suggestion]) }))}>
                          <Text variant="subhead" color="accent">
                            + Período
                          </Text>
                        </Pressable>
                      ) : (
                        <View />
                      )}
                      <Pressable hitSlop={8} onPress={() => copyToOthers(weekday)}>
                        <Text variant="subhead" color="accent">
                          Copiar para os outros dias
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: 16, marginHorizontal: 4 },
  card: { borderRadius: 14, marginBottom: 12, overflow: "hidden", borderCurve: "continuous" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  period: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  periodLabel: { width: 56 },
  issue: { paddingHorizontal: 16, paddingBottom: 8 },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
