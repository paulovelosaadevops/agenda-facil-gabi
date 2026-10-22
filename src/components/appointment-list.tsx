import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { formatInTz, formatMoney } from "@shared/format.ts";
import type { AppointmentWithRefs } from "@shared/types.ts";
import { useTheme } from "@/lib/theme";
import { STATUS_LABEL, statusColor } from "./status";
import { hairline, tap, Text } from "./ui";

/** Lista de agendamentos: horário, barra de status, cliente e serviço. Tocar abre os detalhes. */
export function AppointmentList({ appointments, timeZone }: { appointments: AppointmentWithRefs[]; timeZone: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {appointments.map((a, i) => {
        const inactive = a.status === "cancelled" || a.status === "no_show";
        return (
          <Link key={a.id} href={`/agenda/${a.id}`} asChild>
            <Pressable onPressIn={tap}>
              {({ pressed }) => (
                <View>
                  <View style={[styles.row, pressed && { backgroundColor: theme.fill }]}>
                    <View style={styles.time}>
                      <Text variant="subhead" style={{ fontWeight: "600", fontVariant: ["tabular-nums", "lining-nums"] }}>
                        {formatInTz(a.starts_at, "HH:mm", timeZone)}
                      </Text>
                      <Text variant="footnote" color="label2" style={{ fontVariant: ["tabular-nums", "lining-nums"] }}>
                        {formatInTz(a.ends_at, "HH:mm", timeZone)}
                      </Text>
                    </View>
                    <View style={[styles.bar, { backgroundColor: statusColor(a.status, theme) }]} />
                    <View style={{ flex: 1, opacity: inactive ? 0.5 : 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontWeight: "500", textDecorationLine: a.status === "cancelled" ? "line-through" : "none" }}
                      >
                        {a.clients?.name ?? "Cliente"}
                      </Text>
                      <Text variant="footnote" color="label2" numberOfLines={1}>
                        {a.services?.name} · {formatMoney(a.price_cents)}
                      </Text>
                      {a.status !== "confirmed" && (
                        <Text variant="caption" style={{ color: statusColor(a.status, theme), fontWeight: "600", marginTop: 2 }}>
                          {STATUS_LABEL[a.status]}
                        </Text>
                      )}
                    </View>
                  </View>
                  {i < appointments.length - 1 && (
                    <View style={{ height: hairline, backgroundColor: theme.separator, marginLeft: 84 }} />
                  )}
                </View>
              )}
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: "hidden", borderCurve: "continuous" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  time: { width: 46 },
  bar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
});
