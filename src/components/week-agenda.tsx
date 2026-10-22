import { Pressable, View } from "react-native";
import { dayBounds } from "@shared/availability.ts";
import { formatInTz, formatMoney } from "@shared/format.ts";
import type { AppointmentWithRefs } from "@shared/types.ts";
import { isActive } from "@/lib/use-range-agenda";
import { useTheme } from "@/lib/theme";
import { AppointmentList } from "./appointment-list";
import { Text } from "./ui";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Semana em lista: um bloco por dia com os atendimentos. */
export function WeekAgenda({
  days,
  byDay,
  today,
  timeZone,
  onSelectDay,
}: {
  days: string[];
  byDay: Map<string, AppointmentWithRefs[]>;
  today: string;
  timeZone: string;
  onSelectDay: (date: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 20 }}>
      {days.map((key) => {
        const list = byDay.get(key) ?? [];
        const active = list.filter(isActive);
        const noon = new Date(dayBounds(key, timeZone).start.getTime() + 12 * 3_600_000);
        return (
          <View key={key}>
            <Pressable onPress={() => onSelectDay(key)} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 6 }}>
              <Text variant="title3" style={key === today ? { color: theme.accent } : undefined}>
                {key === today ? "Hoje" : capitalize(formatInTz(noon, "EEEE, d", timeZone))}
              </Text>
              <Text variant="footnote" color="label2">
                {active.length ? `${active.length} · ${formatMoney(active.reduce((s, a) => s + a.price_cents, 0))}` : "Livre"}
              </Text>
            </Pressable>
            {list.length > 0 && <AppointmentList appointments={list} timeZone={timeZone} />}
          </View>
        );
      })}
    </View>
  );
}
