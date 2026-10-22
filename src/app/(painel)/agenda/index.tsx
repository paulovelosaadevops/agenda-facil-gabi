import { addDays, addMonths } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { AppointmentList } from "@/components/appointment-list";
import { Icon } from "@/components/icon";
import { MonthCalendar } from "@/components/month-calendar";
import { ScreenHeader } from "@/components/screen-header";
import { Segmented } from "@/components/segmented";
import { Banner, EmptyState, HeaderButton, Loading, Screen, Text } from "@/components/ui";
import { WeekAgenda } from "@/components/week-agenda";
import { WeekStrip } from "@/components/week-strip";
import { dayBounds, toDateKey } from "@shared/availability.ts";
import { formatInTz, formatMoney } from "@shared/format.ts";
import { useBusiness } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useDayAgenda } from "@/lib/use-day-agenda";
import { isActive, rangeDays, useRangeAgenda, type AgendaView } from "@/lib/use-range-agenda";

const VIEWS: AgendaView[] = ["dia", "semana", "mes"];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AgendaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const tz = business.timezone;
  const today = toDateKey(new Date(), tz);
  const params = useLocalSearchParams<{ data?: string; vista?: string }>();
  const date = params.data && /^\d{4}-\d{2}-\d{2}$/.test(params.data) ? params.data : today;
  const view: AgendaView = VIEWS.includes(params.vista as AgendaView) ? (params.vista as AgendaView) : "dia";
  const noon = new Date(dayBounds(date, tz).start.getTime() + 12 * 3_600_000);

  const day = useDayAgenda(business, date);
  const days = rangeDays(view === "dia" ? "semana" : view, date, tz);
  const range = useRangeAgenda(business, days);
  const current = view === "dia" ? day : range;

  const go = (next: { data?: string; vista?: AgendaView }) =>
    router.setParams({ data: next.data === today ? undefined : next.data, vista: next.vista === "dia" ? undefined : next.vista });

  const shift = (dir: 1 | -1) => {
    const target = view === "mes" ? addMonths(noon, dir) : addDays(noon, 7 * dir);
    go({ data: toDateKey(target, tz), vista: view });
  };

  const dayList = day.data?.list ?? [];
  const dayActive = dayList.filter(isActive);
  const periodActive = (range.data?.all ?? []).filter(isActive);
  const periodLabel =
    view === "mes"
      ? capitalize(formatInTz(noon, "MMMM 'de' yyyy", tz))
      : `${formatInTz(dayBounds(days[0], tz).start, "d MMM", tz)} – ${formatInTz(dayBounds(days[6], tz).start, "d MMM", tz)}`;

  return (
    <Screen refreshing={current.refreshing} onRefresh={current.refresh}>
      <ScreenHeader
        title="Agenda"
        large
        right={
          <>
            {date !== today && <HeaderButton title="Hoje" onPress={() => go({ vista: view })} />}
            <HeaderButton icon="share" accessibilityLabel="Compartilhar horários livres" onPress={() => router.push("/agenda/horarios")} />
            <HeaderButton
              icon="plus"
              accessibilityLabel="Novo agendamento"
              onPress={() => router.push({ pathname: "/agenda/novo", params: { data: date } })}
            />
          </>
        }
      />

      <Segmented values={["Dia", "Semana", "Mês"]} selectedIndex={VIEWS.indexOf(view)} onChange={(i) => go({ data: date, vista: VIEWS[i] })} />

      {current.error && <Banner>{current.error}</Banner>}

      {view === "dia" ? (
        <>
          <WeekStrip date={date} today={today} timeZone={tz} busyDays={day.data?.busyDays ?? new Set()} onSelect={(d) => go({ data: d })} />
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 }}>
            <Text variant="title3">{date === today ? "Hoje" : capitalize(formatInTz(noon, "EEEE, d 'de' MMM", tz))}</Text>
            {dayActive.length > 0 && (
              <Text variant="footnote" color="label2">
                {dayActive.length} {dayActive.length === 1 ? "atendimento" : "atendimentos"} · {formatMoney(dayActive.reduce((s, a) => s + a.price_cents, 0))}
              </Text>
            )}
          </View>
          {day.loading ? (
            <Loading />
          ) : dayList.length ? (
            <AppointmentList appointments={dayList} timeZone={tz} />
          ) : (
            <View style={{ backgroundColor: theme.surface, borderRadius: 12 }}>
              <EmptyState icon="calendar" title="Dia livre" message="Nenhum agendamento para este dia." />
            </View>
          )}
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingHorizontal: 4 }}>
            <View>
              <Text variant="title3">{periodLabel}</Text>
              <Text variant="footnote" color="label2">
                {periodActive.length} {periodActive.length === 1 ? "atendimento" : "atendimentos"} ·{" "}
                {formatMoney(periodActive.reduce((s, a) => s + a.price_cents, 0))} previstos
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 20 }}>
              <Pressable hitSlop={10} accessibilityLabel="Período anterior" onPress={() => shift(-1)}>
                <Icon name="chevronLeft" size={18} color={theme.accent} weight="semibold" />
              </Pressable>
              <Pressable hitSlop={10} accessibilityLabel="Próximo período" onPress={() => shift(1)}>
                <Icon name="chevronRight" size={18} color={theme.accent} weight="semibold" />
              </Pressable>
            </View>
          </View>
          {range.loading || !range.data ? (
            <Loading />
          ) : view === "semana" ? (
            <WeekAgenda days={days} byDay={range.data.byDay} today={today} timeZone={tz} onSelectDay={(d) => go({ data: d })} />
          ) : (
            <>
              <MonthCalendar
                days={days}
                today={today}
                timeZone={tz}
                counts={new Map([...range.data.byDay].map(([k, list]) => [k, list.filter(isActive).length]))}
                onSelect={(d) => go({ data: d })}
              />
              <Text variant="footnote" color="label2" style={{ textAlign: "center", marginTop: 12 }}>
                O número abaixo do dia é a quantidade de atendimentos. Toque no dia para ver a agenda.
              </Text>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
