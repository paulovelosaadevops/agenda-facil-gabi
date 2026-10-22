import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CreatePassword, useHasPassword } from "@/components/create-password";
import { Icon, type IconName } from "@/components/icon";
import { ScreenHeader } from "@/components/screen-header";
import { STATUS_LABEL, statusColor } from "@/components/status";
import { Banner, Button, HeaderButton, Loading, Row, Screen, Section, Text } from "@/components/ui";
import { formatInTz, whatsappLink } from "@shared/format.ts";
import type { AppointmentWithRefs, MaintenanceAlert } from "@shared/types.ts";
import { useAuth, useClient } from "@/lib/auth";
import { Brand } from "@/lib/brand";
import { openCalendar } from "@/lib/ics";
import { useStudioInfo } from "@/lib/studio";
import { callFunction, supabase } from "@/lib/supabase";
import { Serif, useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

/** Painel da cliente: próximo horário, manutenção, agendar e histórico. Simples, pensado para o celular. */
export default function ClientHome() {
  const theme = useTheme();
  const router = useRouter();
  const client = useClient();
  const { signOut } = useAuth();
  const hasPassword = useHasPassword();
  // ?senha=1: entrou pelo "Esqueci minha senha" (código por e-mail) e deve criar uma nova.
  const { senha } = useLocalSearchParams<{ senha?: string }>();
  const { data: studio } = useStudioInfo();
  const tz = studio?.business.timezone ?? "America/Sao_Paulo";
  const phone = studio?.business.phone;
  const first = client.name.split(" ")[0];

  const { data, loading, error, refreshing, refresh } = useQuery(async () => {
    const now = new Date().toISOString();
    const [appts, alerts] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, clients(id, name, phone), services(id, name, duration_min)")
        .eq("client_id", client.id)
        .order("starts_at", { ascending: false })
        .limit(30)
        .returns<AppointmentWithRefs[]>(),
      supabase.from("maintenance_alerts").select("*").eq("client_id", client.id).lte("notify_at", now).returns<MaintenanceAlert[]>(),
    ]);
    if (appts.error) throw appts.error;
    const list = appts.data;
    return {
      upcoming: list.filter((a) => a.starts_at >= now && (a.status === "confirmed" || a.status === "pending")).reverse(),
      history: list.filter((a) => a.starts_at < now || a.status === "cancelled" || a.status === "no_show").slice(0, 3),
      alerts: alerts.data ?? [],
    };
  });

  const next = data?.upcoming[0];
  const later = data?.upcoming.slice(1) ?? [];
  const today = formatInTz(new Date(), "yyyy-MM-dd", tz);
  const addToCalendar = async (appointmentId: string) => {
    const { url } = await callFunction<{ url: string }>("public-booking", { action: "my-calendar", appointmentId });
    openCalendar(url);
  };
  const talkToGabi = (text: string) => phone && Linking.openURL(whatsappLink(phone, text));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader
        title={`Olá, ${first}`}
        subtitle={Brand.fullName}
        large
        right={<HeaderButton icon="person" accessibilityLabel="Meus dados" onPress={() => router.push("/cliente/perfil")} />}
      />
      {error && <Banner>{error}</Banner>}
      {senha === "1" && (
        <View style={{ marginBottom: 20 }}>
          <CreatePassword
            title="Crie uma nova senha"
            message="Para entrar no seu painel com o seu e-mail e esta senha."
            onSaved={() => router.setParams({ senha: undefined })}
          />
        </View>
      )}

      {loading && !data ? (
        <Loading />
      ) : (
        <>
          {/* Próximo horário */}
          {next ? (
            <View style={[styles.next, { backgroundColor: theme.accentStrong }]}>
              <Text variant="overline" style={{ color: theme.champagne }}>
                SEU PRÓXIMO HORÁRIO
              </Text>
              <View style={styles.nextWhen}>
                <Text style={[styles.nextTime, { color: theme.onAccent }]}>{formatInTz(next.starts_at, "HH:mm", tz)}</Text>
                <Text variant="subhead" style={{ color: theme.onAccent, flex: 1 }}>
                  {capitalize(formatInTz(next.starts_at, "EEEE, d 'de' MMMM", tz))}
                </Text>
              </View>
              <Text variant="subhead" numberOfLines={2} style={{ color: theme.onAccent, opacity: 0.75 }}>
                {next.services?.name ?? "Atendimento"}
              </Text>
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
              </View>
            </View>
          ) : (
            <View style={[styles.empty, { backgroundColor: theme.surface }]}>
              <Text variant="headline">Nenhum horário marcado</Text>
              <Text variant="subhead" color="label2" style={{ marginTop: 2 }}>
                Escolha o melhor dia para você.
              </Text>
            </View>
          )}

          {/* Manutenção */}
          {data?.alerts.map((a) => {
            const late = formatInTz(a.due_at, "yyyy-MM-dd", tz) < today;
            return (
              <View key={a.appointment_id} style={[styles.maintenance, { backgroundColor: theme.surface, borderLeftColor: theme.accent }]}>
                <View style={styles.maintenanceHead}>
                  <Icon name="bellOn" size={18} color={theme.accent} />
                  <Text variant="headline">Hora da manutenção</Text>
                </View>
                <Text variant="subhead" color="label2" style={{ marginTop: 4 }}>
                  {a.return_service_name}
                </Text>
                <Text variant="subhead" style={{ marginTop: 2, color: late ? theme.red : theme.label }}>
                  {late ? "Passou da data ideal" : "Ideal até"} {formatInTz(a.due_at, "dd/MM", tz)}
                </Text>
                <Button
                  title="Agendar manutenção"
                  variant="tinted"
                  style={{ marginTop: 14 }}
                  onPress={() => router.push({ pathname: "/cliente/agendar", params: { servico: a.return_service_id } })}
                />
              </View>
            );
          })}

          <Button title="Agendar novo horário" onPress={() => router.push("/cliente/agendar")} style={{ marginBottom: 28 }} />

          {later.length > 0 && (
            <Section header="Também marcados">
              {later.map((a) => (
                <Row key={a.id} title={a.services?.name ?? "Serviço"} subtitle={capitalize(formatInTz(a.starts_at, "EEE, d 'de' MMM 'às' HH:mm", tz))} />
              ))}
            </Section>
          )}

          {Boolean(data?.history.length) && (
            <Section header="Últimos atendimentos">
              {data!.history.map((a) => (
                <Row
                  key={a.id}
                  title={a.services?.name ?? "Serviço"}
                  subtitle={
                    <Text variant="subhead" color="label2">
                      {formatInTz(a.starts_at, "dd/MM/yyyy", tz)} ·{" "}
                      <Text variant="subhead" style={{ color: statusColor(a.status, theme) }}>
                        {STATUS_LABEL[a.status]}
                      </Text>
                    </Text>
                  }
                />
              ))}
            </Section>
          )}

          <Section footer="Para remarcar ou cancelar, fale com a Gabi pelo WhatsApp.">
            {phone && <Row title="Falar com a Gabi" chevron onPress={() => talkToGabi(`Olá, Gabi! Aqui é a ${first}.`)} />}
            {!hasPassword && <Row title="Criar senha de acesso" tone="accent" chevron onPress={() => router.push("/cliente/perfil")} />}
            <Row title="Meus dados" chevron onPress={() => router.push("/cliente/perfil")} />
            <Row title="Sair" tone="destructive" onPress={signOut} />
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  next: { borderRadius: 18, paddingHorizontal: 20, paddingTop: 18, marginBottom: 14, borderCurve: "continuous" },
  nextWhen: { flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 4 },
  nextTime: { fontFamily: Serif.medium, fontSize: 44, lineHeight: 52, fontVariant: ["lining-nums"] },
  cardActions: { flexDirection: "row", gap: 24, marginTop: 14, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  cardAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  empty: { borderRadius: 18, padding: 20, marginBottom: 14, borderCurve: "continuous" },
  maintenance: { borderRadius: 16, borderLeftWidth: 3, padding: 16, marginBottom: 14, borderCurve: "continuous" },
  maintenanceHead: { flexDirection: "row", alignItems: "center", gap: 8 },
});
