import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Icon } from "./icon";
import { tap, Text } from "./ui";

const LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Calendário para escolher um dia, ou um período (primeiro toque = início, segundo = fim).
 * Navega mês a mês, sem a limitação de uma faixa de dias pré-montada. Dias antes de `min` ficam apagados.
 */
export function DateCalendar({
  min,
  start,
  end,
  range,
  onChange,
}: {
  /** Primeiro dia que pode ser escolhido ("yyyy-MM-dd"). */
  min: string;
  start: string;
  end?: string;
  range?: boolean;
  onChange: (start: string, end?: string) => void;
}) {
  const theme = useTheme();
  const [month, setMonth] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) }));
  const minMonth = { y: Number(min.slice(0, 4)), m: Number(min.slice(5, 7)) };
  const canGoBack = month.y > minMonth.y || (month.y === minMonth.y && month.m > minMonth.m);

  const shift = (delta: number) =>
    setMonth(({ y, m }) => {
      const total = y * 12 + (m - 1) + delta;
      return { y: Math.floor(total / 12), m: (total % 12) + 1 };
    });

  const daysInMonth = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(month.y, month.m - 1, 1)).getUTCDay();
  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month.y}-${pad(month.m)}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);

  const select = (key: string) => {
    tap();
    // Período: com o início marcado e sem fim, um dia depois do início fecha o período; qualquer outro recomeça.
    if (range && !end && key > start) onChange(start, key);
    else onChange(key, undefined);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          disabled={!canGoBack}
          hitSlop={8}
          onPress={() => shift(-1)}
          style={({ pressed }) => [styles.nav, { opacity: !canGoBack ? 0.25 : pressed ? 0.5 : 1 }]}
        >
          <Icon name="chevronLeft" size={20} color={theme.accent} />
        </Pressable>
        <Text variant="headline" style={{ textTransform: "capitalize" }}>
          {MONTHS[month.m - 1]} de {month.y}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          hitSlop={8}
          onPress={() => shift(1)}
          style={({ pressed }) => [styles.nav, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Icon name="chevronRight" size={20} color={theme.accent} />
        </Pressable>
      </View>

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
            const past = key < min;
            const edge = key === start || key === end;
            const inside = Boolean(end) && key > start && key < end!;
            return (
              <Pressable
                key={key}
                disabled={past}
                accessibilityRole="button"
                accessibilityState={{ selected: edge || inside, disabled: past }}
                accessibilityLabel={`${Number(key.slice(8))} de ${MONTHS[month.m - 1]}`}
                onPress={() => select(key)}
                style={styles.cell}
              >
                {/* Faixa do período: liga o início ao fim por trás dos números. */}
                {end && (inside || edge) && start !== end && (
                  <View
                    style={[
                      styles.band,
                      { backgroundColor: theme.fill },
                      key === start && { left: "50%" },
                      key === end && { right: "50%" },
                    ]}
                  />
                )}
                <View style={[styles.number, edge && { backgroundColor: theme.accentStrong }]}>
                  <Text
                    style={{
                      color: edge ? theme.onAccent : theme.label,
                      opacity: past ? 0.3 : 1,
                      fontWeight: edge ? "600" : "400",
                      fontVariant: ["tabular-nums", "lining-nums"],
                    }}
                  >
                    {Number(key.slice(8))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Dia seguinte a uma data "yyyy-MM-dd". */
function nextDay(key: string) {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8)) + 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Escolha de um dia. Recolhido (celular), mostra só o dia escolhido, atalhos Hoje/Amanhã e "Trocar",
 * que abre o mês; ao tocar num dia, recolhe de novo. Sem `collapsible`, o calendário fica sempre aberto.
 */
export function DateField({
  min,
  today,
  value,
  label,
  collapsible,
  onChange,
}: {
  min: string;
  today: string;
  value: string;
  /** Dia escolhido por extenso ("Quarta-feira, 22 de outubro"). */
  label: string;
  collapsible?: boolean;
  onChange: (date: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  if (!collapsible || open) {
    return (
      <DateCalendar
        min={min}
        start={value}
        onChange={(d) => {
          setOpen(false);
          onChange(d);
        }}
      />
    );
  }

  const tomorrow = nextDay(today);
  const shortcuts = [
    { key: today, label: "Hoje" },
    { key: tomorrow, label: "Amanhã" },
  ].filter((s) => s.key >= min);
  return (
    <View style={[styles.card, styles.field, { backgroundColor: theme.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Trocar o dia`}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.fieldRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Icon name="calendar" size={20} color={theme.accent} />
        <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        <Text color="accent" style={{ fontWeight: "500" }}>
          Trocar
        </Text>
      </Pressable>
      <View style={styles.shortcuts}>
        {shortcuts.map((s) => {
          const active = s.key === value;
          return (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                tap();
                onChange(s.key);
              }}
              style={[styles.shortcut, { backgroundColor: active ? theme.accentStrong : theme.fill }]}
            >
              <Text variant="subhead" style={{ color: active ? theme.onAccent : theme.label, fontWeight: "600" }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { paddingHorizontal: 12, paddingTop: 6 },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  shortcuts: { flexDirection: "row", gap: 8, paddingTop: 4 },
  shortcut: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  card: { borderRadius: 12, padding: 8, paddingBottom: 12, borderCurve: "continuous" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 6 },
  nav: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row" },
  letter: { flex: 1, textAlign: "center", paddingVertical: 6, fontWeight: "500" },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", height: 44 },
  band: { position: "absolute", top: 4, bottom: 4, left: 0, right: 0 },
  number: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
