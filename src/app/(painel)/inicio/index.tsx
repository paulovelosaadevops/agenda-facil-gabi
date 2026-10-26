import { differenceInMinutes, addDays } from "date-fns";
import { Link, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { AppointmentList } from "@/components/appointment-list";
import { BellButton } from "@/components/bell-button";
import { Icon, type IconName } from "@/components/icon";
import { ScreenHeader } from "@/components/screen-header";
import { publicBookingUrl, ShareLink } from "@/components/share-link";
import { Avatar, Banner, HeaderButton, Loading, Row, Screen, Section, Text } from "@/components/ui";
import { toDateKey } from "@shared/availability.ts";
import { formatInTz } from "@shared/format.ts";
import { useBusiness } from "@/lib/auth";
import { confirmationRequestLink } from "@/lib/confirmation";
import { dbErrorMessage, supabase } from "@/lib/supabase";
import { Serif, useTheme } from "@/lib/theme";
import { useDashboard } from "@/lib/use-dashboard";
import { invalidate } from "@/lib/use-query";

const greeting = (h: number) => (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function relative(target: Date, now: Date, tz: string) {
  const min = differenceInMinutes(target, now);
  if (min < 1) return "agora";
  if (min < 60) return `em ${min} min`;
  if (toDateKey(target, tz) === toDateKey(now, tz)) return `em ${Math.floor(min / 60)} h`;
  if (toDateKey(target, tz) === toDateKey(addDays(now, 1), tz)) return "amanhã";
  return formatInTz(target, "EEEE", tz);
}

const QUICK_ACTIONS: { label: string; icon: IconName; href: Href }[] = [
  { label: "Agendar", icon: "calendarPlus", href: "/agenda/novo" },
  { label: "Horários livres", icon: "share", href: "/agenda/horarios" },
  { label: "Nova cliente", icon: "person", href: "/clientes/form" },
  { label: "Bloquear", icon: "calendarOff", href: "/ajustes/nova-folga" },
];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface }]}>
      <Text variant="overline" color="label2" numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <Text variant="title2" numberOfLines={1} style={{ marginTop: 4 }}>
        {value}
      </Text>
      {hint && (
        <Text variant="caption" color="label3">
          {hint}
        </Text>
      )}
    </View>
  );
}

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function Dashboard() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const tz = business.timezone;
  const { data, error, loading, refreshing, refresh } = useDashboard(business);
  const now = data?.now ?? new Date();
  const next = data?.next;
  const [confirming, setConfirming] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  /** A cliente respondeu: o agendamento passa de pendente para confirmado. */
  const confirm = async (id: string) => {
    setConfirming(id);
    setActionError(undefined);
    const { error: e } = await supabase.from("appointments").update({ status: "confirmed" }).eq("id", id).eq("business_id", business.id);
    setConfirming(undefined);
    if (e) return setActionError(dbErrorMessage(e));
    invalidate();
    refresh();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader
        title={greeting(data?.hour ?? new Date().getHours())}
        subtitle={capitalize(formatInTz(now, "EEEE, d 'de' MMMM", tz))}
        large
        right={
          <>
            <BellButton businessId={business.id} />
            <HeaderButton icon="plus" accessibilityLabel="Novo agendamento" onPress={() => router.push("/agenda/novo")} />
          </>
        }
      />
      {error && <Banner>{error}</Banner>}
      {actionError && <Banner>{actionError}</Banner>}
      {loading || !data ? (
        <Loading />
      ) : (
        <>
          {next ? (
            <Link href={`/agenda/${next.id}`} asChild>
              {/* O estilo fica no View de dentro: na web o Link descarta o estilo dinâmico do Pressable. */}
              <Pressable>
                {({ pressed }) => (
                <View style={[styles.hero, { backgroundColor: theme.accentStrong, opacity: pressed ? 0.85 : 1 }]}>
                  <View style={styles.heroTop}>
                    <Text variant="overline" style={{ color: theme.champagne }}>
                      PRÓXIMO ATENDIMENTO
                    </Text>
                    <Text variant="footnote" style={{ color: theme.champagne }}>
                      {relative(new Date(next.starts_at), now, tz)}
                    </Text>
                  </View>
                  <Text style={[styles.heroTime, { color: theme.onAccent }]}>{formatInTz(next.starts_at, "HH:mm", tz)}</Text>
                  <View style={[styles.heroRule, { backgroundColor: theme.champagne }]} />
                  <Text variant="headline" style={{ color: theme.onAccent, fontWeight: "500" }}>
                    {next.clients?.name}
                  </Text>
                  <Text variant="subhead" style={{ color: theme.onAccent, opacity: 0.7 }}>
                    {next.services?.name}
                  </Text>
                </View>
                )}
              </Pressable>
            </Link>
          ) : (
            <View style={[styles.emptyHero, { backgroundColor: theme.surface }]}>
              <Icon name="calendar" size={30} color={theme.label3} />
              <View style={{ flex: 1 }}>
                <Text variant="headline">Nenhum atendimento marcado</Text>
                <Text variant="footnote" color="label2">
                  Compartilhe seu link para receber agendamentos.
                </Text>
              </View>
            </View>
          )}

          {/* Atalhos rápidos */}
          <View style={styles.actions}>
            {QUICK_ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                onPress={() => router.push(a.href)}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.surface, opacity: pressed ? 0.6 : 1 }]}
              >
                <Icon name={a.icon} size={22} color={theme.accent} />
                <Text variant="caption" style={{ fontWeight: "500", textAlign: "center" }}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Véspera: pedir confirmação pelo WhatsApp e marcar quando a cliente responder. */}
          {data.toConfirm.length > 0 && (
            <Section header="Pedir confirmação · amanhã" footer="Toque no WhatsApp para enviar o pedido já escrito. Quando a cliente responder, toque em Confirmar.">
              {data.toConfirm.map((a) => (
                <Row
                  key={a.id}
                  leading={<Avatar name={a.clients?.name ?? "?"} size={34} />}
                  inset={62}
                  title={a.clients?.name ?? "Cliente"}
                  subtitle={`${formatInTz(a.starts_at, "HH:mm", tz)} · ${a.services?.name ?? "Atendimento"}`}
                  href={`/agenda/${a.id}`}
                  trailing={
                    <View style={styles.confirmActions}>
                      <Pressable
                        hitSlop={10}
                        accessibilityLabel={`Pedir confirmação para ${a.clients?.name} no WhatsApp`}
                        onPress={() => {
                          const link = confirmationRequestLink(a, tz, now);
                          if (link) void Linking.openURL(link);
                        }}
                      >
                        <Icon name="message" size={22} color={theme.accent} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Marcar ${a.clients?.name} como confirmada`}
                        disabled={confirming === a.id}
                        onPress={() => void confirm(a.id)}
                        style={({ pressed }) => [styles.confirmButton, { backgroundColor: theme.fill, opacity: pressed || confirming === a.id ? 0.5 : 1 }]}
                      >
                        <Text variant="subhead" color="accent" style={{ fontWeight: "600" }}>
                          Confirmar
                        </Text>
                      </Pressable>
                    </View>
                  }
                />
              ))}
            </Section>
          )}

          {/* Lucro do mês: o realizado é o que a Gabi marcou como concluído; o previsto, o que já foi confirmado. */}
          <View style={[styles.profit, { backgroundColor: theme.surface }]}>
            <Text variant="overline" color="label2">
              {`LUCRO DE ${formatInTz(now, "MMMM", tz).toUpperCase()}`}
            </Text>
            <View style={styles.profitRow}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="label2">
                  Realizado
                </Text>
                <Text style={[styles.profitValue, { color: theme.label }]}>{money(data.monthRevenue)}</Text>
                <Text variant="caption" color="label3">
                  {data.monthDone} {data.monthDone === 1 ? "atendimento concluído" : "atendimentos concluídos"}
                </Text>
              </View>
              <View style={[styles.profitDivider, { backgroundColor: theme.separator }]} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="label2">
                  Previsto
                </Text>
                <Text style={[styles.profitValue, { color: theme.accent }]}>{money(data.monthConfirmed)}</Text>
                <Text variant="caption" color="label3">
                  confirmados a realizar
                </Text>
              </View>
            </View>
            {data.monthPending > 0 && (
              <Text variant="footnote" color="label2" style={{ marginTop: 12 }}>
                + {money(data.monthPending)} aguardando confirmação
              </Text>
            )}
          </View>

          {/* Números do negócio */}
          <View style={styles.stats}>
            {[
              ["Hoje", String(data.today.filter((a) => a.status !== "cancelled" && a.status !== "no_show").length), "atendimentos"],
              ["Próximos 7 dias", String(data.upcoming), "agendados"],
              ["Ticket médio", data.monthDone ? money(Math.round(data.monthRevenue / data.monthDone)) : "—", "no mês"],
              ["Atendidas", String(data.monthDone), "no mês"],
              ["Novas clientes", String(data.newClients), "no mês"],
            ].map(([label, value, hint]) => (
              <Stat key={label} label={label} value={value} hint={hint} />
            ))}
          </View>

          {data.maintenance.length > 0 && (
            <Section header="Retornos de manutenção" footer="Clientes que estão chegando (ou já passaram) da data ideal de retorno.">
              {data.maintenance.map((m) => {
                const late = new Date(m.due_at) < now;
                return (
                  <Row
                    key={m.appointment_id}
                    leading={<Avatar name={m.client_name} size={34} />}
                    inset={62}
                    title={m.client_name}
                    subtitle={
                      <Text variant="subhead" style={{ color: late ? theme.red : theme.label2 }}>
                        {m.return_service_name} · {late ? "atrasada desde" : "ideal até"} {formatInTz(m.due_at, "dd/MM", tz)}
                      </Text>
                    }
                    href={{ pathname: "/agenda/novo", params: { cliente: m.client_id, servico: m.return_service_id } }}
                    trailing={
                      <Pressable
                        hitSlop={10}
                        accessibilityLabel={`Chamar ${m.client_name} no WhatsApp`}
                        onPress={() =>
                          Linking.openURL(
                            `https://wa.me/${m.client_phone}?text=${encodeURIComponent(
                              `Olá, ${m.client_name.split(" ")[0]}! Está chegando a hora da manutenção do seu ${m.service_name.toLowerCase()}. Vamos agendar seu horário?`,
                            )}`,
                          )
                        }
                      >
                        <Icon name="message" size={22} color={theme.accent} />
                      </Pressable>
                    }
                  />
                );
              })}
            </Section>
          )}

          <View style={styles.sectionTitle}>
            <Text variant="title3">Hoje</Text>
            <Link href="/agenda">
              <Text variant="subhead" color="accent">
                Agenda ›
              </Text>
            </Link>
          </View>
          <View style={{ marginBottom: 28 }}>
            {data.today.length ? (
              <AppointmentList appointments={data.today} timeZone={tz} />
            ) : (
              <View style={[styles.emptyToday, { backgroundColor: theme.surface }]}>
                <Text color="label2">Nenhum agendamento hoje.</Text>
              </View>
            )}
          </View>

          <Section header="Link de agendamento" footer="Coloque na bio do Instagram e na mensagem de ausência do WhatsApp.">
            <ShareLink url={publicBookingUrl()} title={`Agende com ${business.name}`} />
          </Section>

          {data.birthdays.length > 0 && (
            <Section header="Aniversariantes do mês">
              {data.birthdays.map((c) => (
                <Row
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  leading={<Avatar name={c.name} size={32} />}
                  inset={60}
                  title={c.name}
                  detail={`${c.birthday!.slice(8, 10)}/${c.birthday!.slice(5, 7)}`}
                  chevron
                />
              ))}
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 18, paddingHorizontal: 22, paddingVertical: 20, marginBottom: 12, borderCurve: "continuous" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  // Hora em serifada grande: o elemento "editorial" da tela.
  heroTime: { fontFamily: Serif.medium, fontSize: 56, lineHeight: 62, marginTop: 8, fontVariant: ["lining-nums"] },
  heroRule: { width: 28, height: StyleSheet.hairlineWidth * 2, marginVertical: 12, opacity: 0.8 },
  emptyHero: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, padding: 20, marginBottom: 12 },
  // Duas colunas: cabe "R$ 12.480" mesmo no iPhone pequeno.
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  action: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14, borderCurve: "continuous" },
  stat: { flexGrow: 1, flexBasis: "45%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderCurve: "continuous" },
  sectionTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 },
  emptyToday: { borderRadius: 12, padding: 20, alignItems: "center" },
  confirmActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  confirmButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  profit: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, borderCurve: "continuous" },
  profitRow: { flexDirection: "row", alignItems: "stretch", gap: 14, marginTop: 10 },
  profitDivider: { width: StyleSheet.hairlineWidth },
  profitValue: { fontFamily: Serif.medium, fontSize: 30, lineHeight: 36, fontVariant: ["lining-nums"] },
});
