import { Pressable } from "react-native";
import { PushSettings } from "@/components/push-settings";
import { ScreenHeader } from "@/components/screen-header";
import { publicBookingUrl, ShareLink } from "@/components/share-link";
import { AppMark, Row, RowIcon, Screen, Section, Text } from "@/components/ui";
import { formatPhone } from "@shared/format.ts";
import { useAuth, useBusiness } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Resume os dias abertos: "Ter–Sáb", "Seg, Qua, Sex"... */
function summarizeDays(days: number[]): string {
  if (!days.length) return "Fechado";
  const sorted = [...new Set(days)].sort();
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 2) return `${WEEKDAY_SHORT[sorted[0]]}–${WEEKDAY_SHORT[sorted.at(-1)!]}`;
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

export default function SettingsScreen() {
  const theme = useTheme();
  const business = useBusiness();
  const { session, signOut } = useAuth();

  const { data } = useQuery(async () => {
    const [hours, services, timeOff] = await Promise.all([
      supabase.from("working_hours").select("weekday").eq("business_id", business.id),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true),
      supabase.from("time_off").select("id", { count: "exact", head: true }).eq("business_id", business.id).gte("ends_at", new Date().toISOString()),
    ]);
    return {
      days: summarizeDays((hours.data ?? []).map((h) => h.weekday)),
      services: services.count ?? 0,
      timeOff: timeOff.count ?? 0,
    };
  });

  return (
    <Screen>
      <ScreenHeader title="Ajustes" large />

      <Section>
        <Row
          href="/ajustes/estudio"
          leading={<AppMark size={58} name={business.name} />}
          inset={90}
          title={<Text variant="title3">{business.name}</Text>}
          subtitle={business.phone ? formatPhone(business.phone) : session?.user.email}
          chevron
        />
      </Section>

      <Section>
        <Row href="/ajustes/estudio" leading={<RowIcon name="store" />} title="Dados do estúdio" chevron />
        <Row href="/ajustes/servicos" leading={<RowIcon name="tag" />} title="Serviços" detail={String(data?.services ?? "")} chevron />
      </Section>

      <Section>
        <Row href="/ajustes/expediente" leading={<RowIcon name="clock" />} title="Expediente" detail={data?.days} chevron />
        <Row
          href="/ajustes/folgas"
          leading={<RowIcon name="calendarOff" />}
          title="Bloqueios"
          detail={data?.timeOff ? String(data.timeOff) : undefined}
          chevron
        />
        <Row href="/ajustes/agendamento" leading={<RowIcon name="calendarClock" />} title="Regras de agendamento" chevron />
      </Section>


      <PushSettings businessId={business.id} />

      <Section header="Link de agendamento" footer="Suas clientes escolhem o serviço e o horário sozinhas por este link.">
        <ShareLink url={publicBookingUrl()} title={`Agende com ${business.name}`} />
      </Section>

      <Section footer={session?.user.email ? `Conectada como ${session.user.email}` : undefined}>
        <Pressable onPress={signOut} style={({ pressed }) => ({ minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? theme.fill : undefined })}>
          <Text color="red">Sair</Text>
        </Pressable>
      </Section>
    </Screen>
  );
}
