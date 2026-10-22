import { TZDate } from "@date-fns/tz";
import { Pressable, StyleSheet, View } from "react-native";
import { dayBounds } from "@shared/availability.ts";
import { useTheme } from "@/lib/theme";
import { tap, Text } from "./ui";

const LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Calendário do mês: número de atendimentos por dia. Tocar num dia abre a visão do dia. */
export function MonthCalendar({
  days,
  counts,
  today,
  timeZone,
  onSelect,
}: {
  days: string[];
  counts: Map<string, number>;
  today: string;
  timeZone: string;
  onSelect: (date: string) => void;
}) {
  const theme = useTheme();
  const firstWeekday = new TZDate(dayBounds(days[0], timeZone).start.getTime() + 12 * 3_600_000, timeZone).getDay();
  const cells: (string | null)[] = [...Array(firstWeekday).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.week}>
        {LETTERS.map((l, i) => (
          <Text key={i} variant="caption" color="label2" style={styles.letter}>
            {l}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.week}>
          {cells.slice(row * 7, row * 7 + 7).map((key, i) => {
            if (!key) return <View key={i} style={styles.cell} />;
            const count = counts.get(key) ?? 0;
            const isToday = key === today;
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [styles.cell, pressed && { backgroundColor: theme.fill }]}
                accessibilityLabel={`${Number(key.slice(8))}: ${count} atendimento${count === 1 ? "" : "s"}`}
                onPress={() => {
                  tap();
                  onSelect(key);
                }}
              >
                <View style={[styles.number, isToday && { backgroundColor: theme.accentStrong }]}>
                  <Text style={{ color: isToday ? theme.onAccent : theme.label, fontWeight: isToday ? "600" : "400", fontVariant: ["tabular-nums", "lining-nums"] }}>
                    {Number(key.slice(8))}
                  </Text>
                </View>
                <Text variant="caption" style={{ color: count ? theme.accent : "transparent", fontWeight: "600", marginTop: 2 }}>
                  {count || "·"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 8, borderCurve: "continuous" },
  week: { flexDirection: "row" },
  letter: { flex: 1, textAlign: "center", paddingVertical: 6, fontWeight: "500" },
  cell: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 10, minHeight: 58 },
  number: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
