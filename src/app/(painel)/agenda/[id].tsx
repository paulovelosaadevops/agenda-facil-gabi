import { Linking, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScreenHeader } from "@/components/screen-header";
import { SOURCE_LABEL, STATUS_LABEL, statusColor } from "@/components/status";
import { Banner, HeaderButton, Loading, Row, RowIcon, Screen, Section, Text } from "@/components/ui";
import { formatDuration, formatInTz, formatMoney, whatsappLink } from "@shared/format.ts";
import type { AppointmentStatus, AppointmentWithRefs } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { openCalendar } from "@/lib/ics";
import { callFunction, dbErrorMessage, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { invalidate, useQuery } from "@/lib/use-query";

export default function AppointmentDetail() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const tz = business.timezone;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const { data: appt, loading } = useQuery(async () => {
    const { data, error: e } = await supabase
      .from("appointments")
      .select("*, clients(id, name, phone), services(id, name, duration_min)")
      .eq("business_id", business.id)
      .eq("id", id)
      .maybeSingle<AppointmentWithRefs>();
    if (e) throw e;
    return data;
  }, [id]);

  const setStatus = async (status: AppointmentStatus) => {
    setBusy(true);
    setError(undefined);
    const { error: e } = await supabase.from("appointments").update({ status }).eq("id", id).eq("business_id", business.id);
    setBusy(false);
    if (e) return setError(dbErrorMessage(e));
    invalidate();
    router.back();
  };

  const header = <ScreenHeader title="Agendamento" right={<HeaderButton title="OK" bold onPress={() => router.back()} />} />;
  if (loading) return <Screen>{header}<Loading /></Screen>;
  if (!appt) return <Screen>{header}<Banner>Agendamento não encontrado.</Banner></Screen>;

  const active = appt.status === "pending" || appt.status === "confirmed";
  const when = formatInTz(appt.starts_at, "EEEE, d 'de' MMMM", tz);

  return (
    <Screen>
      {header}
      <View style={{ alignItems: "center", paddingVertical: 12, marginBottom: 16, opacity: busy ? 0.5 : 1 }}>
        <Text variant="title2">{appt.clients?.name}</Text>
        <Text color="label2" style={{ marginTop: 2 }}>
          {appt.services?.name}
        </Text>
        <Text style={{ marginTop: 12, fontWeight: "500" }}>{when.charAt(0).toUpperCase() + when.slice(1)}</Text>
        <Text color="label2" style={{ fontVariant: ["tabular-nums", "lining-nums"] }}>
          {formatInTz(appt.starts_at, "HH:mm", tz)} – {formatInTz(appt.ends_at, "HH:mm", tz)}
          {appt.services ? ` · ${formatDuration(appt.services.duration_min)}` : ""}
        </Text>
      </View>

      <Section>
        <Row title="Status" detail={<Text style={{ color: statusColor(appt.status, theme) }}>{STATUS_LABEL[appt.status]}</Text>} />
        <Row title="Valor" detail={formatMoney(appt.price_cents)} />
        <Row title="Origem" detail={SOURCE_LABEL[appt.source]} />
        {appt.notes ? <Row title={appt.notes} tone="muted" numberOfLines={0} /> : null}
      </Section>

      {appt.clients && (
        <Section>
          <Row
            leading={<RowIcon name="message" />}
            title="Confirmar pelo WhatsApp"
            chevron
            onPress={() =>
              Linking.openURL(
                whatsappLink(
                  appt.clients!.phone,
                  `Olá, ${appt.clients!.name.split(" ")[0]}! Aqui é a Gabi. Passando para confirmar seu horário de ${appt.services?.name ?? "atendimento"} ` +
                    `marcado para ${formatInTz(appt.starts_at, "EEEE, dd/MM 'às' HH:mm", business.timezone)}. Posso contar com você?`,
                ),
              )
            }
          />
          <Row leading={<RowIcon name="person" />} title="Ver cliente" chevron href={`/clientes/${appt.clients.id}`} />
          <Row
            leading={<RowIcon name="calendarPlus" />}
            title="Adicionar ao calendário"
            chevron
            onPress={async () => {
              try {
                const { url } = await callFunction<{ url: string }>("panel", { action: "calendar-url", appointmentId: appt.id });
                openCalendar(url);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Não foi possível abrir o calendário.");
              }
            }}
          />
        </Section>
      )}

      {error && <Banner>{error}</Banner>}

      <Section>
        {active ? (
          [
            <Row key="c" leading={<RowIcon name="check" />} title="Concluir atendimento" onPress={() => setStatus("completed")} />,
            <Row key="n" leading={<RowIcon name="noShow" />} title="Cliente não compareceu" onPress={() => setStatus("no_show")} />,
            <Row key="x" leading={<RowIcon name="cancel" tone="destructive" />} title="Cancelar agendamento" tone="destructive" onPress={() => setStatus("cancelled")} />,
          ]
        ) : (
          <Row leading={<RowIcon name="reopen" />} title="Reabrir agendamento" onPress={() => setStatus("confirmed")} />
        )}
      </Section>
    </Screen>
  );
}
