import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/icon";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState, HeaderButton, Loading, Row, Screen, Section } from "@/components/ui";
import { toDateKey } from "@shared/availability.ts";
import { formatInTz } from "@shared/format.ts";
import type { TimeOff } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { invalidate, useQuery } from "@/lib/use-query";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function describe(t: TimeOff, tz: string) {
  const start = new Date(t.starts_at);
  const end = new Date(new Date(t.ends_at).getTime() - 1); // fim exclusivo
  const allDay = formatInTz(start, "HH:mm", tz) === "00:00" && formatInTz(t.ends_at, "HH:mm", tz) === "00:00";
  const sameDay = toDateKey(start, tz) === toDateKey(end, tz);
  if (allDay) {
    return sameDay ? capitalize(formatInTz(start, "EEEE, d 'de' MMM", tz)) : `${formatInTz(start, "d 'de' MMM", tz)} – ${formatInTz(end, "d 'de' MMM", tz)}`;
  }
  return sameDay
    ? `${formatInTz(start, "d 'de' MMM, HH:mm", tz)} – ${formatInTz(t.ends_at, "HH:mm", tz)}`
    : `${formatInTz(start, "d/MM HH:mm", tz)} – ${formatInTz(t.ends_at, "d/MM HH:mm", tz)}`;
}

export default function TimeOffSettings() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const { data, loading } = useQuery(async () => {
    const { data: rows } = await supabase
      .from("time_off")
      .select("*")
      .eq("business_id", business.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .returns<TimeOff[]>();
    return rows ?? [];
  });

  const remove = async (id: string) => {
    await supabase.from("time_off").delete().eq("id", id).eq("business_id", business.id);
    invalidate();
  };

  return (
    <Screen>
      <ScreenHeader title="Bloqueios" right={<HeaderButton icon="plus" accessibilityLabel="Bloquear" onPress={() => router.push("/ajustes/nova-folga")} />} />
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <Section footer="Horários bloqueados não aparecem para as clientes.">
          {data.map((t) => (
            <Row
              key={t.id}
              title={describe(t, business.timezone)}
              subtitle={t.reason || undefined}
              trailing={
                <Pressable onPress={() => remove(t.id)} hitSlop={10} accessibilityLabel="Remover bloqueio">
                  <View style={{ padding: 4 }}>
                    <Icon name="trash" size={20} color={theme.red} />
                  </View>
                </Pressable>
              }
            />
          ))}
        </Section>
      ) : (
        <EmptyState icon="calendarOff" title="Nenhum bloqueio" message="Toque em + para bloquear horários, um dia ou suas férias." />
      )}
    </Screen>
  );
}
