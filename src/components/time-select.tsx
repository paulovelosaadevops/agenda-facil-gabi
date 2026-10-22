import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { SlotChips } from "./slot-chips";
import { tap, Text } from "./ui";

/** "06:00", "06:30"... até `to` (inclusive). */
export function timeOptions(from = "06:00", to = "22:00", stepMin = 30): string[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const pad = (n: number) => String(n).padStart(2, "0");
  const list: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += stepMin) list.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return list;
}

/**
 * Botão com o horário ("09:00") que abre uma folha com a grade de horários.
 * Igual no iPhone, Android e web (o seletor nativo compacto se sobrepunha nas linhas).
 */
export function TimeSelect({
  value,
  onChange,
  title = "Horário",
  options = timeOptions(),
  placeholder = "Escolher",
}: {
  value: string;
  onChange: (value: string) => void;
  title?: string;
  options?: string[];
  placeholder?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value || placeholder}`}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.pill, { backgroundColor: theme.fill, opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={{ color: value ? theme.label : theme.label3, fontWeight: "500", fontVariant: ["tabular-nums", "lining-nums"] }}>
          {value || placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text variant="title3">{title}</Text>
            <Pressable hitSlop={10} onPress={() => setOpen(false)}>
              <Text color="accent" style={{ fontWeight: "600" }}>
                Fechar
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <SlotChips
              slots={options}
              selected={value}
              onSelect={(t) => {
                onChange(t);
                setOpen(false);
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { minWidth: 72, height: 36, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: { maxHeight: "70%", width: "100%", maxWidth: 560, alignSelf: "center", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
});
