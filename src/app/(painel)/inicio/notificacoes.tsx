import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Href } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { Banner, EmptyState, Loading, Row, Screen, Section, Text } from "@/components/ui";
import { useBusiness } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { markAllRead, useNotifications } from "@/lib/use-notifications";

/** Agendamentos novos feitos pelo link e retornos de manutenção. Abrir a lista marca tudo como visto. */
export default function Notifications() {
  const theme = useTheme();
  const business = useBusiness();
  const { data, loading, error } = useNotifications(business.id);
  const hasUnread = (data ?? []).some((n) => !n.read_at);

  // Deixa os pontinhos de "nova" visíveis um instante antes de marcar como vistas.
  useEffect(() => {
    if (!hasUnread) return;
    const id = setTimeout(() => void markAllRead(business.id), 1500);
    return () => clearTimeout(id);
  }, [hasUnread, business.id]);

  return (
    <Screen>
      <ScreenHeader title="Notificações" />
      {error && <Banner>{error}</Banner>}
      {loading && !data ? (
        <Loading />
      ) : data?.length ? (
        <Section footer="Para receber também na tela do celular, ative em Ajustes › Notificações no celular.">
          {data.map((n) => (
            <Row
              key={n.id}
              leading={<View style={[styles.dot, { backgroundColor: n.read_at ? "transparent" : theme.accent }]} />}
              inset={36}
              title={<Text style={{ fontWeight: n.read_at ? "400" : "600" }}>{n.title}</Text>}
              subtitle={`${n.body} · ${formatDistanceToNow(new Date(n.created_at), { locale: ptBR, addSuffix: true })}`}
              href={(n.url ?? (n.appointment_id ? `/agenda/${n.appointment_id}` : undefined)) as Href | undefined}
              chevron={Boolean(n.url || n.appointment_id)}
            />
          ))}
        </Section>
      ) : (
        <EmptyState icon="bell" title="Nenhuma notificação" message="Agendamentos novos pelo link e retornos de manutenção aparecem aqui." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
});
