import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { Icon } from "./icon";
import { FormRow, Row, Section, tap, Text } from "./ui";

export interface PickerGroup<T> {
  label: string;
  options: { label: string; detail?: string; value: T }[];
}

/**
 * Linha de formulário com seletor separado por grupos (ex.: Primeira aplicação, Manutenção...).
 * No app abre uma folha com a lista agrupada; na web é um <select> com <optgroup> (ver .web.tsx).
 */
export function GroupedPickerRow<T extends string>({
  label,
  value,
  groups,
  onChange,
  placeholder = "Escolher",
}: {
  label: string;
  value: T | "";
  groups: PickerGroup<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value);

  return (
    <FormRow label={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.trigger, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text color={selected ? "label" : "label2"} numberOfLines={1} style={{ flexShrink: 1, textAlign: "right" }}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevronRight" size={14} color={theme.label3} weight="semibold" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text variant="title3">{label}</Text>
            <Pressable hitSlop={10} onPress={() => setOpen(false)}>
              <Text color="accent" style={{ fontWeight: "600" }}>
                Fechar
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            {groups.map((g) => (
              <Section key={g.label} header={g.label}>
                {g.options.map((o) => (
                  <Row
                    key={o.value}
                    title={o.label}
                    subtitle={o.detail}
                    trailing={o.value === value ? <Icon name="check" size={18} color={theme.accent} /> : undefined}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  />
                ))}
              </Section>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </FormRow>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, flex: 1, minWidth: 0 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: { maxHeight: "75%", width: "100%", maxWidth: 560, alignSelf: "center", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
});
