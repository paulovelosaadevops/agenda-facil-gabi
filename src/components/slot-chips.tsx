import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { tap, Text } from "./ui";

/**
 * Grade de horários ("09:00", "09:30"...) em botões.
 * `selected` aceita um horário ou vários (seleção múltipla); `disabled` fica riscado e não responde ao toque.
 */
export function SlotChips({
  slots,
  selected,
  disabled = [],
  onSelect,
}: {
  slots: string[];
  selected?: string | string[];
  disabled?: string[];
  onSelect: (slot: string) => void;
}) {
  const theme = useTheme();
  // 4 por linha ocupando a largura exata (porcentagem deixava sobra à direita).
  const [width, setWidth] = useState(0);
  const chipWidth = width ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : undefined;
  const isSelected = (s: string) => (Array.isArray(selected) ? selected.includes(s) : s === selected);
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {slots.map((s) => {
        const active = isSelected(s);
        const off = disabled.includes(s);
        return (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: off }}
            disabled={off}
            onPress={() => {
              tap();
              onSelect(s);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                width: chipWidth ?? "23%",
                backgroundColor: active ? theme.accentStrong : off ? "transparent" : theme.surface,
                borderColor: off ? theme.separator : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: active ? theme.onAccent : off ? theme.label3 : theme.label,
                fontWeight: "500",
                textDecorationLine: off ? "line-through" : "none",
                fontVariant: ["tabular-nums", "lining-nums"],
              }}
            >
              {s}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const COLUMNS = 4;
const GAP = 8;

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  chip: {
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
});
