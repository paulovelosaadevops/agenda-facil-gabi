import { Platform, Pressable, ScrollView, StyleSheet } from "react-native";
import type { DayOption } from "@/lib/studio";
import { useTheme } from "@/lib/theme";
import { tap, Text } from "./ui";

/** Faixa horizontal de dias ("HOJE 20", "QUA 21"...). */
export function DayChips({ days, selected, onSelect }: { days: DayOption[]; selected?: string; onSelect: (key: string) => void }) {
  const theme = useTheme();
  return (
    // No computador não há gesto de arrastar: a barra de rolagem mostra que há mais dias.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={Platform.OS === "web"}
      contentContainerStyle={{ gap: 8, paddingBottom: Platform.OS === "web" ? 10 : 4 }}
      style={{ marginBottom: 20 }}
    >
      {days.map((d) => {
        const active = d.key === selected;
        return (
          <Pressable
            key={d.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onSelect(d.key);
            }}
            style={[styles.chip, { backgroundColor: active ? theme.accentStrong : theme.surface }]}
          >
            <Text variant="caption" style={{ color: active ? theme.onAccent : theme.label2, opacity: active ? 0.75 : 1, fontWeight: "500", letterSpacing: 0.8 }}>
              {d.weekday.toUpperCase()}
            </Text>
            <Text variant="title3" style={{ color: active ? theme.onAccent : theme.label, fontVariant: ["tabular-nums", "lining-nums"] }}>
              {d.day}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { width: 54, height: 68, borderRadius: 16, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
});
