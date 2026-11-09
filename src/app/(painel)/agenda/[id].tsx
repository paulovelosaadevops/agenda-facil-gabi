import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { PickerRow } from "@/components/picker-row";
import { ScreenHeader } from "@/components/screen-header";
import { SOURCE_LABEL, STATUS_LABEL, statusColor } from "@/components/status";
import { Avatar, Banner, Button, FormRow, HeaderButton, Input, Loading, Screen, Section, Text } from "@/components/ui";
import { formatInTz, formatMoney, parseMoney, whatsappLink } from "@shared/format.ts";
import {
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  paymentStatus,
  type AppointmentStatus,
  type AppointmentWithRefs,
  type Payment,
  type PaymentKind,
  type PaymentMethod,
} from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { confirmationRequestLink } from "@/lib/confirmation";
import { openCalendar } from "@/lib/ics";
import { callFunction, dbErrorMessage, supabase } from "@/lib/supabase";
import { Serif, useTheme } from "@/lib/theme";
import { invalidate, useQuery } from "@/lib/use-query";

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ label: PAYMENT_METHOD_LABEL[m], value: m }));
const toInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Pergunta na própria tela (igual no celular e na web), com até três respostas. */
function Question({ title, message, options }: { title: string; message?: string; options: { label: string; onPress: () => void; variant?: "filled" | "tinted" | "plain" }[] }) {
  const theme = useTheme();
  return (
    <View style={[styles.question, { backgroundColor: theme.surface, borderColor: theme.champagne }]}>
      <Text variant="headline">{title}</Text>
      {message && (
        <Text variant="subhead" color="label2" style={{ marginTop: 2 }}>
          {message}
        </Text>
      )}
      <View style={{ gap: 8, marginTop: 14 }}>
        {options.map((o) => (
          <Button key={o.label} title={o.label} variant={o.variant ?? "tinted"} onPress={o.onPress} />
        ))}
      </View>
    </View>
  );
}

export default function AppointmentDetail() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const tz = business.timezone;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Pergunta aberta antes de concluir (restante a receber) ou cancelar (sinal pago).
  const [ask, setAsk] = useState<"complete" | "cancel">();
  // Registrar pagamento: formulário aberto, valor e forma.
  const [paying, setPaying] = useState(false);
  const [payValue, setPayValue] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("pix");
  const [showPayments, setShowPayments] = useState(false);

  const { data, loading, refresh } = useQuery(async () => {
    const [appt, payments] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, clients(id, name, phone), services(id, name, duration_min)")
        .eq("business_id", business.id)
        .eq("id", id)
        .maybeSingle<AppointmentWithRefs>(),
      supabase.from("payments").select("*").eq("appointment_id", id).order("paid_at").returns<Payment[]>(),
    ]);
    if (appt.error) throw appt.error;
    return { appt: appt.data, payments: payments.data ?? [] };
  }, [id]);
  const appt = data?.appt;

  const setStatus = async (status: AppointmentStatus) => {
    setBusy(true);
    setError(undefined);
    const { error: e } = await supabase.from("appointments").update({ status }).eq("id", id).eq("business_id", business.id);
    setBusy(false);
    if (e) return setError(dbErrorMessage(e));
    invalidate();
    router.back();
  };

  /** Lança um recebimento (ou devolução, com valor negativo). */
  const addPayment = async (amount: number, kind: PaymentKind, method: PaymentMethod): Promise<boolean> => {
    setError(undefined);
    const { error: e } = await supabase.from("payments").insert({ business_id: business.id, appointment_id: id, amount_cents: amount, kind, method });
    if (e) {
      setError(dbErrorMessage(e));
      return false;
    }
    return true;
  };

  const header = <ScreenHeader title="Agendamento" right={<HeaderButton title="OK" bold onPress={() => router.back()} />} />;
  if (loading && !data) return <Screen>{header}<Loading /></Screen>;
  if (!appt) return <Screen>{header}<Banner>Agendamento não encontrado.</Banner></Screen>;

  const active = appt.status === "pending" || appt.status === "confirmed";
  const when = formatInTz(appt.starts_at, "EEEE, d 'de' MMMM", tz);
  const pay = paymentStatus(appt);
  const lastMethod = data!.payments.filter((p) => p.amount_cents > 0).at(-1)?.method ?? "pix";

  const openPayForm = () => {
    setPayValue(pay.remaining > 0 ? toInput(pay.remaining) : "");
    setPayMethod(lastMethod);
    setPaying(true);
  };

  const savePayment = async () => {
    const amount = parseMoney(payValue);
    if (!(amount > 0)) return setError("Informe o valor recebido.");
    // Tipo só para o histórico: quita tudo de uma vez = integral; quita o que faltava = restante; senão, sinal.
    const kind: PaymentKind = appt.paid_cents <= 0 && amount >= appt.price_cents ? "integral" : appt.paid_cents > 0 && amount >= pay.remaining ? "restante" : "sinal";
    setBusy(true);
    const ok = await addPayment(amount, kind, payMethod);
    setBusy(false);
    if (!ok) return;
    setPaying(false);
    invalidate();
    refresh();
  };

  // Concluir: com sinal e algo a receber, pergunta antes.
  const complete = () => (appt.paid_cents > 0 && pay.remaining > 0 ? setAsk("complete") : setStatus("completed"));
  // Cancelar: com sinal pago, pergunta se devolve.
  const cancel = () => (appt.paid_cents > 0 ? setAsk("cancel") : setStatus("cancelled"));

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    ...(appt.clients
      ? [
          {
            icon: "message" as IconName,
            // Pendente: pede a confirmação; depois, só abre a conversa.
            label: appt.status === "pending" ? "Pedir confirmação" : "WhatsApp",
            onPress: () =>
              void Linking.openURL(
                appt.status === "pending"
                  ? confirmationRequestLink(appt, tz)!
                  : whatsappLink(appt.clients!.phone, `Olá, ${appt.clients!.name.split(" ")[0]}! Aqui é a Gabi.`),
              ),
          },
        ]
      : []),
    ...(appt.status === "pending" ? [{ icon: "check" as IconName, label: "Confirmar", onPress: () => void setStatus("confirmed") }] : []),
    ...(active ? [{ icon: "pencil" as IconName, label: "Editar", onPress: () => router.push({ pathname: "/agenda/novo", params: { id: appt.id } }) }] : []),
    {
      icon: "calendarPlus",
      label: "Calendário",
      onPress: async () => {
        try {
          const { url } = await callFunction<{ url: string }>("panel", { action: "calendar-url", appointmentId: appt.id });
          openCalendar(url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Não foi possível abrir o calendário.");
        }
      },
    },
    ...(appt.clients ? [{ icon: "person" as IconName, label: "Cliente", onPress: () => router.push(`/clientes/${appt.clients!.id}`) }] : []),
  ];
  const statusTint = statusColor(appt.status, theme);

  return (
    <Screen>
      {header}

      {/* Quem, o quê e quando: centralizado, sem lista. */}
      <View style={[styles.hero, { opacity: busy ? 0.5 : 1 }]}>
        <Avatar name={appt.clients?.name ?? "?"} size={64} />
        <Text variant="title2" style={{ marginTop: 12, textAlign: "center" }}>
          {appt.clients?.name}
        </Text>
        <Text color="label2" style={{ marginTop: 2, textAlign: "center" }}>
          {appt.services?.name}
        </Text>
        <View style={[styles.when, { backgroundColor: theme.surface }]}>
          <Icon name="calendar" size={15} color={theme.accent} />
          <Text variant="subhead" style={{ fontWeight: "600", fontVariant: ["tabular-nums", "lining-nums"] }}>
            {when.charAt(0).toUpperCase() + when.slice(1)} · {formatInTz(appt.starts_at, "HH:mm", tz)}–{formatInTz(appt.ends_at, "HH:mm", tz)}
          </Text>
        </View>
        <View style={[styles.statusPill, { borderColor: statusTint }]}>
          <Text variant="caption" style={{ color: statusTint, fontWeight: "700" }}>
            {STATUS_LABEL[appt.status].toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Ações rápidas: um botão para cada coisa. */}
      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            onPress={a.onPress}
            style={({ pressed }) => [styles.action, { backgroundColor: theme.surface, opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={a.icon} size={22} color={theme.accent} />
            <Text variant="caption" numberOfLines={2} style={{ fontWeight: "500", textAlign: "center" }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Pagamento: valor em destaque, situação e um botão. Lançamentos ficam recolhidos. */}
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text variant="overline" style={{ color: theme.champagne, textAlign: "center" }}>
          PAGAMENTO
        </Text>
        <Text style={[styles.price, { color: theme.label }]}>{formatMoney(appt.price_cents)}</Text>
        <Text
          variant="subhead"
          style={{ textAlign: "center", fontWeight: "600", color: pay.label === "Pago" ? theme.green : pay.label === "Sinal" ? theme.accent : theme.label2 }}
        >
          {pay.label === "Pago" ? "Pago ✓" : pay.label === "Sinal" ? `Sinal ${formatMoney(appt.paid_cents)} · falta ${formatMoney(pay.remaining)}` : "Não pago"}
        </Text>
        {data!.payments.length > 0 && (
          <Pressable hitSlop={8} onPress={() => setShowPayments((v) => !v)} style={{ alignSelf: "center", marginTop: 8 }}>
            <Text variant="footnote" color="accent">
              {showPayments ? "Ocultar lançamentos" : `Ver lançamentos (${data!.payments.length})`}
            </Text>
          </Pressable>
        )}
        {showPayments &&
          data!.payments.map((p) => (
            <View key={p.id} style={[styles.paymentLine, { borderTopColor: theme.separator }]}>
              <View style={{ flex: 1 }}>
                <Text variant="subhead">{PAYMENT_KIND_LABEL[p.kind]}</Text>
                <Text variant="caption" color="label2">
                  {formatInTz(p.paid_at, "dd/MM/yyyy", tz)} · {PAYMENT_METHOD_LABEL[p.method]}
                </Text>
              </View>
              <Text variant="subhead" style={{ color: p.amount_cents < 0 ? theme.red : theme.label, fontWeight: "600" }}>
                {formatMoney(p.amount_cents)}
              </Text>
            </View>
          ))}
        {paying ? (
          <View style={{ marginTop: 16 }}>
            <Section footer={pay.remaining > 0 ? `Falta receber ${formatMoney(pay.remaining)}.` : undefined} style={{ marginBottom: 12 }}>
              <FormRow label="Valor recebido">
                <Input value={payValue} onChangeText={setPayValue} placeholder="R$ 0,00" keyboardType="decimal-pad" autoFocus />
              </FormRow>
              <PickerRow label="Forma" value={payMethod} onChange={setPayMethod} options={METHOD_OPTIONS} />
            </Section>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="Cancelar" variant="tinted" style={{ flex: 1 }} onPress={() => setPaying(false)} />
              <Button title="Salvar" style={{ flex: 1 }} loading={busy} onPress={savePayment} />
            </View>
          </View>
        ) : (
          (active || pay.remaining > 0) && <Button title="Registrar pagamento" icon="tag" variant="tinted" style={{ marginTop: 16 }} onPress={openPayForm} />
        )}
      </View>

      {appt.notes ? (
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text variant="overline" style={{ color: theme.champagne, textAlign: "center" }}>
            OBSERVAÇÕES
          </Text>
          <Text color="label2" style={{ textAlign: "center", marginTop: 6 }}>
            {appt.notes}
          </Text>
        </View>
      ) : null}

      {error && <Banner>{error}</Banner>}

      {ask === "complete" && (
        <Question
          title={`Recebeu o restante (${formatMoney(pay.remaining)})?`}
          message={`Sinal já pago: ${formatMoney(appt.paid_cents)}.`}
          options={[
            {
              label: "Sim, recebi",
              variant: "filled",
              onPress: async () => {
                setBusy(true);
                const ok = await addPayment(pay.remaining, "restante", lastMethod);
                setBusy(false);
                if (ok) void setStatus("completed");
              },
            },
            { label: "Ainda não", onPress: () => void setStatus("completed") },
            { label: "Voltar", variant: "plain", onPress: () => setAsk(undefined) },
          ]}
        />
      )}
      {ask === "cancel" && (
        <Question
          title={`Devolver o sinal de ${formatMoney(appt.paid_cents)}?`}
          message="Se não devolver, o valor continua contando no seu lucro."
          options={[
            {
              label: "Sim, devolver",
              onPress: async () => {
                setBusy(true);
                const ok = await addPayment(-appt.paid_cents, "devolucao", lastMethod);
                setBusy(false);
                if (ok) void setStatus("cancelled");
              },
            },
            { label: "Não, o sinal fica comigo", onPress: () => void setStatus("cancelled") },
            { label: "Voltar", variant: "plain", onPress: () => setAsk(undefined) },
          ]}
        />
      )}

      {/* Ação principal em destaque; as demais, discretas. */}
      {!ask &&
        (active ? (
          <View style={{ gap: 6 }}>
            <Button title="Concluir atendimento" icon="check" onPress={complete} loading={busy} />
            <View style={styles.secondary}>
              <Button title="Não compareceu" variant="plain" style={{ flex: 1 }} onPress={() => void setStatus("no_show")} />
              <Button title="Cancelar" variant="destructive" style={{ flex: 1 }} onPress={cancel} />
            </View>
          </View>
        ) : (
          // Reaberto volta a precisar de confirmação.
          <Button title="Reabrir agendamento" icon="reopen" variant="tinted" onPress={() => void setStatus("pending")} />
        ))}

      <Text variant="caption" color="label3" style={{ textAlign: "center", marginTop: 20 }}>
        Origem: {SOURCE_LABEL[appt.source]}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, borderCurve: "continuous" },
  hero: { alignItems: "center", paddingTop: 8, marginBottom: 20 },
  when: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  statusPill: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  action: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14, borderCurve: "continuous" },
  card: { borderRadius: 18, padding: 18, marginBottom: 16, borderCurve: "continuous" },
  price: { fontFamily: Serif.medium, fontSize: 36, lineHeight: 42, textAlign: "center", marginTop: 4, fontVariant: ["lining-nums"] },
  paymentLine: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 10, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  secondary: { flexDirection: "row", gap: 10 },
});
