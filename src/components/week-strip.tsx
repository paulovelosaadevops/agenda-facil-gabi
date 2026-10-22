import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { Pressable, StyleSheet, View } from "react-native";
import { dayBounds, toDateKey } from "@shared/availability.ts";
import { formatInTz } from "@shared/format.ts";
import { useTheme } from "@/lib/theme";
import { Icon } from "./icon";
import { tap, Text } from "./ui";

const LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Faixa da semana, como no Calendário do iPhone. Bolinha = dia com atendimentos. */
export function WeekStrip({
  date,
  today,
  timeZone,
  busyDays,
  onSelect,
}: {
  date: string;
  today: string;
  timeZone: string;
  busyDays: Set<string>;
  onSelect: (date: string) => void;
}) {
  const theme = useTheme();
  const noon = new Date(dayBounds(date, timeZone).start.getTime() + 12 * 3_600_000);
  const sunday = addDays(noon, -new TZDate(noon.getTime(), timeZone).getDay());
  const days = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  const month = formatInTz(noon, "MMMM 'de' yyyy", timeZone);

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={styles.header}>
        <Text variant="title3">{month.charAt(0).toUpperCase() + month.slice(1)}</Text>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <Pressable hitSlop={10} accessibilityLabel="Semana anterior" onPress={() => onSelect(toDateKey(addDays(noon, -7), timeZone))}>
            <Icon name="chevronLeft" size={18} color={theme.accent} weight="semibold" />
          </Pressable>
          <Pressable hitSlop={10} accessibilityLabel="Próxima semana" onPress={() => onSelect(toDateKey(addDays(noon, 7), timeZone))}>
            <Icon name="chevronRight" size={18} color={theme.accent} weight="semibold" />
          </Pressable>
        </View>
      </View>
      <View style={[styles.strip, { backgroundColor: theme.surface }]}>
        {days.map((d, i) => {
          const key = toDateKey(d, timeZone);
          const selected = key === date;
          const isToday = key === today;
          const circle = selected ? (isToday ? theme.accentStrong : theme.label) : "transparent";
          const numberColor = selected ? (isToday ? theme.onAccent : theme.bg) : isToday ? theme.accent : theme.label;
          return (
            <Pressable
              key={key}
              style={styles.day}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={formatInTz(d, "EEEE, d 'de' MMMM", timeZone)}
              onPress={() => {
                tap();
                onSelect(key);
              }}
            >
              <Text variant="caption" color="label2" style={{ fontWeight: "500" }}>
                {LETTERS[i]}
              </Text>
              <View style={[styles.circle, { backgroundColor: circle }]}>
                <Text style={{ color: numberColor, fontWeight: selected || isToday ? "600" : "400", fontVariant: ["tabular-nums", "lining-nums"] }}>
                  {formatInTz(d, "d", timeZone)}
                </Text>
              </View>
              <View style={[styles.dot, { backgroundColor: busyDays.has(key) ? theme.label3 : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 },
  strip: { flexDirection: "row", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4, borderCurve: "continuous" },
  day: { flex: 1, alignItems: "center", gap: 4 },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
