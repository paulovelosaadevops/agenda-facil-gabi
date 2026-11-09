import { Linking, Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { ClientHistoryRow } from "@/components/client-history-row";
import { HowItWorksModal } from "@/components/how-it-works";
import { Icon, type IconName } from "@/components/icon";
import { ScreenHeader } from "@/components/screen-header";
import { Banner, Button, Loading, Row, RowIcon, Screen, Section, Text } from "@/components/ui";
import { parseDateKey, toDateKey } from "@shared/availability.ts";
import { formatInTz, formatMoney, summarizeWorkingHours, whatsappLink } from "@shared/format.ts";
import { paymentStatus, type AppointmentWithRefs, type MaintenanceAlert } from "@shared/types.ts";
import { useAuth, useClient } from "@/lib/auth";
import { Brand } from "@/lib/brand";
import { openCalendar } from "@/lib/ics";
import { useStudioInfo } from "@/lib/studio";
import { callFunction, supabase } from "@/lib/supabase";
import { Serif, useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type DoneAppointment = { service_id: string; services: { id: string; name: string } | null };

/** Dias de calendário entre duas datas, no fuso do estúdio. */
function daysBetween(from: Date, to: Date, tz: string) {
  const [y1, m1, d1] = parseDateKey(toDateKey(from, tz));
  const [y2, m2, d2] = parseDateKey(toDateKey(to, tz));
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** "Hoje, em 2h", "Amanhã", "Em 3 dias". */
function countdown(start: Date, now: Date, tz: string) {
  const days = daysBetween(now, start, tz);
  if (days === 1) return "Amanhã";
  if (days > 1) return `Em ${days} dias`;
  const minutes = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60_000));
  return minutes < 60 ? `Hoje, em ${minutes} min` : `Hoje, em ${Math.floor(minutes / 60)}h`;
}

/** Atalho do cartão do próximo horário: ícone + texto, sem cara de botão pesado. */
function CardAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.cardAction, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={17} color={theme.champagne} />
      <Text variant="subhead" style={{ color: theme.onAccent, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Atalho do topo do painel (mesmo desenho da tela Início da Gabi). */
function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, { backgroundColor: theme.surface, opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={22} color={theme.accent} />
      <Text variant="caption" style={{ fontWeight: "500", textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Iniciais da cliente num círculo dourado (abre "Meus dados"). */
function Initials({ name, onPress }: { name: string; onPress: () => void }) {
  const theme = useTheme();
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Meus dados" hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.initials, { backgroundColor: theme.champagne, opacity: pressed ? 0.7 : 1 }]}>
      <RNText style={styles.initialsText}>{initials || "?"}</RNText>
    </Pressable>
  );
}

/** Manutenção: barra com os dias até a data ideal; perto dela, fica dourada e oferece o agendamento. */
function MaintenanceCard({ alert, now, tz, onBook }: { alert: MaintenanceAlert; now: Date; tz: string; onBook: () => void }) {
  const theme = useTheme();
  const total = Math.max(1, daysBetween(new Date(alert.done_at), new Date(alert.due_at), tz));
  const elapsed = Math.max(0, daysBetween(new Date(alert.done_at), now, tz));
  const near = now >= new Date(alert.notify_at);
  const late = daysBetween(new Date(alert.due_at), now, tz) > 0;
  const due = formatInTz(alert.due_at, "dd/MM", tz);
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.cardHead}>
        <Icon name={near ? "bellOn" : "refresh"} size={18} color={near ? theme.champagne : theme.accent} />
        <Text variant="headline" style={{ flex: 1 }}>
          {near ? "Hora da manutenção" : "Sua manutenção"}
        </Text>
        <Text variant="footnote" color="label2" style={{ fontVariant: ["tabular-nums", "lining-nums"] }}>
          {Math.min(elapsed, total)} de {total} dias
        </Text>
      </View>
      <Text variant="subhead" color="label2" numberOfLines={2} style={{ marginTop: 4 }}>
        {alert.return_service_name}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: Math.min(elapsed, total) }}
        style={[styles.track, { backgroundColor: theme.fill }]}
      >
        <View style={[styles.trackFill, { width: `${Math.min(100, (elapsed / total) * 100)}%`, backgroundColor: near ? theme.champagne : theme.accent }]} />
      </View>
      <Text variant="footnote" style={{ color: late ? theme.red : theme.label2 }}>
        {late ? "Passou da data ideal" : "Ideal até"} {due}
      </Text>
      {near && <Button title="Agendar manutenção" variant="tinted" style={{ marginTop: 14 }} onPress={onBook} />}
    </View>
  );
}

/** Painel da cliente: próximo horário, atalhos, manutenção, histórico e estúdio. Pensado para o celular. */
export default function ClientHome() {
  const theme = useTheme();
  const router = useRouter();
  const client = useClient();
  const { session, signOut } = useAuth();
  const { data: studio } = useStudioInfo();
  // Boas-vindas do primeiro acesso: some depois do "Começar a usar" (marcado na própria conta, vale em qualquer aparelho).
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const showWelcome = !welcomeDismissed && !session?.user.user_metadata?.welcome_seen;
  const dismissWelcome = () => {
    setWelcomeDismissed(true);
    void supabase.auth.updateUser({ data: { welcome_seen: true } });
  };
  const tz = studio?.business.timezone ?? "America/Sao_Paulo";
  const phone = studio?.business.phone;
  const address = studio?.business.address;
  const first = client.name.split(" ")[0];

  const { data, loading, error, refreshing, refresh } = useQuery(async () => {
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const [appts, alerts, done] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, clients(id, name, phone), services(id, name, duration_min)")
        .eq("client_id", client.id)
        .order("starts_at", { ascending: false })
        .limit(30)
        .returns<AppointmentWithRefs[]>(),
      // Todas as manutenções em aberto (não só as já avisadas): a barra acompanha desde o atendimento.
      supabase.from("maintenance_alerts").select("*").eq("client_id", client.id).order("due_at").returns<MaintenanceAlert[]>(),
      // Atendimentos concluídos: "Repetir" e "Sua história com a Gabi".
      supabase
        .from("appointments")
        .select("service_id, services(id, name)")
        .eq("client_id", client.id)
        .eq("status", "completed")
        .order("starts_at", { ascending: false })
        .limit(500)
        .returns<DoneAppointment[]>(),
    ]);
    if (appts.error) throw appts.error;
    const list = appts.data;
    const history = list.filter((a) => a.starts_at < now || a.status === "cancelled" || a.status === "no_show");

    // Serviço favorito: o mais feito (no empate, o mais recente, pois a lista vem do mais novo ao mais antigo).
    const completed = done.data ?? [];
    const counts = new Map<string, number>();
    for (const a of completed) if (a.services) counts.set(a.services.name, (counts.get(a.services.name) ?? 0) + 1);
    const favorite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      now,
      upcoming: list.filter((a) => a.starts_at >= now && (a.status === "confirmed" || a.status === "pending")).reverse(),
      history: history.slice(0, 3),
      hasMoreHistory: history.length > 3,
      alerts: alerts.data ?? [],
      visits: completed.length,
      favorite,
      lastServiceId: completed[0]?.service_id,
    };
  });

  const now = new Date(data?.now ?? 0); // Só é usado com os dados carregados.
  const next = data?.upcoming[0];
  const later = data?.upcoming.slice(1) ?? [];
  const addToCalendar = async (appointmentId: string) => {
    const { url } = await callFunction<{ url: string }>("public-booking", { action: "my-calendar", appointmentId });
    openCalendar(url);
  };
  const talkToGabi = (text: string) => phone && Linking.openURL(whatsappLink(phone, text));
  const openMap = () => address && Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  const hours = summarizeWorkingHours(studio?.hours ?? []);
  const lastServiceId = data?.lastServiceId;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title={`Olá, ${first}`} subtitle={Brand.fullName} large right={<Initials name={client.name} onPress={() => router.push("/cliente/perfil")} />} />
      {error && <Banner>{error}</Banner>}
      {/* Primeiro acesso: boas-vindas + passo a passo. Depois, o mesmo popup abre em "Como funciona". */}
      <HowItWorksModal
        visible={showWelcome || howItWorksOpen}
        maxDays={studio?.business.max_advance_days ?? 14}
        welcomeName={showWelcome ? first : undefined}
        onClose={() => (showWelcome ? dismissWelcome() : setHowItWorksOpen(false))}
      />

      {loading && !data ? (
        <Loading />
      ) : (
        <>
          {/* Próximo horário */}
          {next ? (
            <View style={[styles.next, { backgroundColor: theme.accentStrong }]}>
              <View style={styles.nextTop}>
                <Text variant="overline" style={{ color: theme.champagne }}>
                  SEU PRÓXIMO HORÁRIO
                </Text>
                <Text variant="footnote" style={{ color: theme.champagne, fontWeight: "600" }}>
                  {countdown(new Date(next.starts_at), now, tz)}
                </Text>
              </View>
              <View style={styles.nextWhen}>
                <Text style={[styles.nextTime, { color: theme.onAccent }]}>{formatInTz(next.starts_at, "HH:mm", tz)}</Text>
                <Text variant="subhead" style={{ color: theme.onAccent, flex: 1 }}>
                  {capitalize(formatInTz(next.starts_at, "EEEE, d 'de' MMMM", tz))}
                </Text>
              </View>
              <Text variant="subhead" numberOfLines={2} style={{ color: theme.onAccent, opacity: 0.75 }}>
                {next.services?.name ?? "Atendimento"}
              </Text>
              {/* Selo: a cliente sabe se a Gabi já confirmou. */}
              <View style={[styles.badge, { borderColor: theme.champagne }]}>
                <Icon name={next.status === "confirmed" ? "check" : "clock"} size={13} color={theme.champagne} />
                <Text variant="caption" style={{ color: theme.onAccent, fontWeight: "600" }}>
                  {next.status === "confirmed" ? "Confirmado" : "Aguardando confirmação"}
                </Text>
              </View>
              {/* Pagamento antecipado registrado pela Gabi. */}
              {next.paid_cents > 0 && (
                <Text variant="footnote" style={{ color: theme.onAccent, opacity: 0.85, marginTop: 8 }}>
                  {paymentStatus(next).label === "Pago"
                    ? "Já está pago ✓"
                    : `Sinal pago: ${formatMoney(next.paid_cents)} · restante ${formatMoney(paymentStatus(next).remaining)} no dia`}
                </Text>
              )}
              <View style={[styles.cardActions, { borderTopColor: "rgba(247,243,238,0.14)" }]}>
                <CardAction icon="calendarPlus" label="Calendário" onPress={() => void addToCalendar(next.id)} />
                {phone && (
                  <CardAction
                    icon="message"
                    label="Remarcar"
                    onPress={() =>
                      talkToGabi(
                        `Olá, Gabi! Aqui é a ${first}. Preciso remarcar meu horário de ${next.services?.name ?? "atendimento"} ` +
                          `marcado para ${formatInTz(next.starts_at, "EEEE, dd/MM 'às' HH:mm", tz)}. Quais outros horários você tem?`,
                      )
                    }
                  />
                )}
                {address && <CardAction icon="mapPin" label="Como chegar" onPress={() => void openMap()} />}
              </View>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text variant="headline">Nenhum horário marcado</Text>
              <Text variant="subhead" color="label2" style={{ marginTop: 2 }}>
                Escolha o melhor dia para você.
              </Text>
              <Button title="Agendar horário" style={{ marginTop: 14 }} onPress={() => router.push("/cliente/agendar")} />
            </View>
          )}

          {/* Atalhos */}
          <View style={styles.quickActions}>
            <QuickAction icon="calendarPlus" label="Agendar" onPress={() => router.push("/cliente/agendar")} />
            {lastServiceId && (
              <QuickAction icon="refresh" label="Repetir" onPress={() => router.push({ pathname: "/cliente/agendar", params: { servico: lastServiceId } })} />
            )}
            {phone && <QuickAction icon="message" label="WhatsApp" onPress={() => void talkToGabi(`Olá, Gabi! Aqui é a ${first}.`)} />}
            <QuickAction icon="sparkles" label="Como funciona" onPress={() => setHowItWorksOpen(true)} />
          </View>

          {/* Manutenção */}
          {data?.alerts.map((a) => (
            <MaintenanceCard
              key={a.appointment_id}
              alert={a}
              now={now}
              tz={tz}
              onBook={() => router.push({ pathname: "/cliente/agendar", params: { servico: a.return_service_id } })}
            />
          ))}

          {later.length > 0 && (
            <Section header="Também marcados" style={{ marginTop: 14 }}>
              {later.map((a) => (
                <Row
                  key={a.id}
                  leading={<RowIcon name="calendar" />}
                  title={a.services?.name ?? "Serviço"}
                  subtitle={capitalize(formatInTz(a.starts_at, "EEE, d 'de' MMM 'às' HH:mm", tz))}
                />
              ))}
            </Section>
          )}

          {Boolean(data?.history.length) && (
            <View style={{ marginTop: 14 }}>
              <View style={styles.sectionTitle}>
                <Text variant="title3">Últimos atendimentos</Text>
                {data?.hasMoreHistory && (
                  <Link href="/cliente/historico">
                    <Text variant="subhead" color="accent">
                      Ver todos ›
                    </Text>
                  </Link>
                )}
              </View>
              <Section>
                {data!.history.map((a) => (
                  <ClientHistoryRow key={a.id} appointment={a} timeZone={tz} />
                ))}
              </Section>
            </View>
          )}

          {/* Sua história com a Gabi: só depois do primeiro atendimento concluído. */}
          {Boolean(data?.visits) && (
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text variant="overline" style={{ color: theme.champagne }}>
                SUA HISTÓRIA COM A GABI
              </Text>
              <View style={styles.storyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.storyNumber, { color: theme.label }]}>{data!.visits}</Text>
                  <Text variant="footnote" color="label2">
                    {data!.visits === 1 ? "atendimento" : "atendimentos"}
                  </Text>
                </View>
                <View style={[styles.storyDivider, { backgroundColor: theme.separator }]} />
                <View style={{ flex: 2 }}>
                  <Text variant="footnote" color="label2">
                    Cliente desde
                  </Text>
                  <Text variant="subhead" style={{ fontWeight: "600" }}>
                    {formatInTz(client.created_at, "MMMM 'de' yyyy", tz)}
                  </Text>
                  {data!.favorite && (
                    <>
                      <Text variant="footnote" color="label2" style={{ marginTop: 6 }}>
                        Serviço favorito
                      </Text>
                      <Text variant="subhead" numberOfLines={2} style={{ fontWeight: "600" }}>
                        {data!.favorite}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Estúdio */}
          {(address || hours.length > 0) && (
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text variant="overline" style={{ color: theme.champagne }}>
                O ESTÚDIO
              </Text>
              {address && (
                <View style={[styles.studioLine, { marginTop: 10 }]}>
                  <Icon name="mapPin" size={16} color={theme.accent} />
                  <Text variant="subhead" style={{ flex: 1 }}>
                    {address}
                  </Text>
                </View>
              )}
              {hours.map((h, i) => (
                <View key={h.days} style={[styles.studioLine, { marginTop: i === 0 ? 10 : 4 }]}>
                  <View style={{ opacity: i === 0 ? 1 : 0 }}>
                    <Icon name="clock" size={16} color={theme.accent} />
                  </View>
                  <Text variant="subhead" style={{ width: 76, fontWeight: "600" }}>
                    {h.days}
                  </Text>
                  <Text variant="subhead" color="label2" style={{ flex: 1, fontVariant: ["tabular-nums", "lining-nums"] }}>
                    {h.periods}
                  </Text>
                </View>
              ))}
              <View style={styles.studioActions}>
                {address && <Button title="Como chegar" variant="tinted" style={{ flex: 1 }} onPress={() => void openMap()} />}
                {phone && <Button title="WhatsApp" variant="tinted" style={{ flex: 1 }} onPress={() => void talkToGabi(`Olá, Gabi! Aqui é a ${first}.`)} />}
              </View>
            </View>
          )}

          <Section footer="Para remarcar ou cancelar, fale com a Gabi pelo WhatsApp." style={{ marginTop: 14 }}>
            <Row leading={<RowIcon name="person" />} title="Meus dados" chevron onPress={() => router.push("/cliente/perfil")} />
            <Row leading={<RowIcon name="logout" tone="destructive" />} title="Sair" tone="destructive" onPress={signOut} />
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  initials: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  initialsText: { fontFamily: Serif.semibold, fontSize: 16, color: "#1D1A18" },
  next: { borderRadius: 18, paddingHorizontal: 20, paddingTop: 18, marginBottom: 12, borderCurve: "continuous" },
  nextTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  nextWhen: { flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 4 },
  nextTime: { fontFamily: Serif.medium, fontSize: 44, lineHeight: 52, fontVariant: ["lining-nums"] },
  badge: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 10, marginTop: 14, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  cardAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  quickActions: { flexDirection: "row", gap: 8, marginBottom: 14 },
  quickAction: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14, borderCurve: "continuous" },
  card: { borderRadius: 18, padding: 18, marginBottom: 14, borderCurve: "continuous" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 12, marginBottom: 8 },
  trackFill: { height: "100%", borderRadius: 4 },
  sectionTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 },
  storyRow: { flexDirection: "row", alignItems: "stretch", gap: 14, marginTop: 10 },
  storyNumber: { fontFamily: Serif.medium, fontSize: 40, lineHeight: 46, fontVariant: ["lining-nums"] },
  storyDivider: { width: StyleSheet.hairlineWidth },
  studioLine: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  studioActions: { flexDirection: "row", gap: 10, marginTop: 16 },
});
