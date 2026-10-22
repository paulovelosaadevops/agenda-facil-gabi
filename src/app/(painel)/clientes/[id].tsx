import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "@/components/icon";
import { ScreenHeader } from "@/components/screen-header";
import { STATUS_LABEL, statusColor } from "@/components/status";
import { Avatar, Banner, HeaderButton, Loading, Row, Screen, Section, tap, Text } from "@/components/ui";
import { formatInTz, formatMoney, formatPhone, whatsappLink } from "@shared/format.ts";
import type { AppointmentWithRefs, Client } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

export default function ClientDetail() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const tz = business.timezone;
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, error } = useQuery(async () => {
    const [client, appts] = await Promise.all([
      supabase.from("clients").select("*").eq("business_id", business.id).eq("id", id).maybeSingle<Client>(),
      supabase
        .from("appointments")
        .select("*, clients(id, name, phone), services(id, name, duration_min)")
        .eq("business_id", business.id)
        .eq("client_id", id)
        .order("starts_at", { ascending: false })
        .limit(50)
        .returns<AppointmentWithRefs[]>(),
    ]);
    if (client.error) throw client.error;
    return { client: client.data, history: appts.data ?? [] };
  }, [id]);

  if (loading) return <Screen><Loading /></Screen>;
  const client = data?.client;
  if (!client) return <Screen><Banner>{error ?? "Cliente não encontrada."}</Banner></Screen>;

  const completed = data.history.filter((a) => a.status === "completed");
  const spent = completed.reduce((s, a) => s + a.price_cents, 0);
  const birthday = client.birthday ? `${client.birthday.slice(8, 10)}/${client.birthday.slice(5, 7)}` : null;

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    // Sem WhatsApp, "mensagem" abre o SMS.
    {
      icon: "message",
      label: client.whatsapp ? "WhatsApp" : "Mensagem",
      onPress: () =>
        Linking.openURL(client.whatsapp ? whatsappLink(client.phone, `Olá, ${client.name.split(" ")[0]}! Aqui é a Gabi.`) : `sms:+${client.phone}`),
    },
    { icon: "phone", label: "Ligar", onPress: () => Linking.openURL(`tel:+${client.phone}`) },
    {
      icon: "calendarPlus",
      label: "Agendar",
      onPress: () => router.push({ pathname: "/agenda/novo", params: { cliente: client.id } } as Href),
    },
  ];

  return (
    <Screen>
      <ScreenHeader
        title={client.name.split(" ")[0]}
        right={<HeaderButton title="Editar" onPress={() => router.push({ pathname: "/clientes/form", params: { id: client.id } })} />}
      />
      <View style={styles.hero}>
        <Avatar name={client.name} size={92} />
        <Text variant="title1" style={{ marginTop: 12, textAlign: "center" }}>
          {client.name}
        </Text>
        <Text color="label2">{formatPhone(client.phone)}</Text>
      </View>

      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => {
              tap();
              a.onPress();
            }}
            style={({ pressed }) => [styles.action, { backgroundColor: theme.surface, opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={a.icon} size={22} color={theme.accent} />
            <Text variant="caption" color="accent" style={{ fontWeight: "500" }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Section>
        <Row title="Atendimentos" detail={String(completed.length)} />
        <Row title="Total gasto" detail={formatMoney(spent)} />
        <Row title="Último atendimento" detail={completed[0] ? formatInTz(completed[0].starts_at, "dd/MM/yyyy", tz) : "—"} />
        <Row title="Cliente desde" detail={formatInTz(client.created_at, "MMM 'de' yyyy", tz)} />
      </Section>

      <Section>
        <Row title="WhatsApp" detail={client.whatsapp ? "Sim" : "Não"} />
        <Row title="Faz pés" detail={client.feet ? "Sim" : "Não"} />
        {client.instagram ? (
          <Row
            title="Instagram"
            detail={<Text color="accent">{client.instagram}</Text>}
            onPress={() => Linking.openURL(`https://instagram.com/${client.instagram.replace(/^@/, "")}`)}
          />
        ) : null}
        {client.email ? <Row title="E-mail" detail={client.email} /> : null}
        <Row title="Conta para agendar" detail={client.user_id ? "Ativa" : "Sem conta"} />
      </Section>

      {(birthday || client.notes) && (
        <Section>
          {birthday ? <Row title="Aniversário" detail={birthday} /> : null}
          {client.notes ? (
            <Row
              title={<Text variant="footnote" color="label2">Observações</Text>}
              subtitle={<Text style={{ marginTop: 2 }}>{client.notes}</Text>}
            />
          ) : null}
        </Section>
      )}

      <Section header="Histórico">
        {data.history.length ? (
          data.history.map((a) => (
            <Row
              key={a.id}
              href={`/agenda/${a.id}`}
              title={a.services?.name ?? "Serviço"}
              subtitle={
                <Text variant="subhead" color="label2">
                  {formatInTz(a.starts_at, "dd/MM/yyyy · HH:mm", tz)} ·{" "}
                  <Text variant="subhead" style={{ color: statusColor(a.status, theme) }}>
                    {STATUS_LABEL[a.status]}
                  </Text>
                </Text>
              }
              detail={formatMoney(a.price_cents)}
            />
          ))
        ) : (
          <Row title="Nenhum atendimento ainda" tone="muted" />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 8, paddingBottom: 20 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 28 },
  action: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: 12, borderCurve: "continuous" },
});
