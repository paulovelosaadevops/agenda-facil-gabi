import { Linking, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { PickerRow } from "@/components/picker-row";
import { ScreenHeader } from "@/components/screen-header";
import { SOURCE_LABEL, STATUS_LABEL, statusColor } from "@/components/status";
import { Banner, Button, FormRow, HeaderButton, Input, Loading, Row, RowIcon, Screen, Section, Text } from "@/components/ui";
import { formatDuration, formatInTz, formatMoney, parseMoney, whatsappLink } from "@shared/format.ts";
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
import { useTheme } from "@/lib/theme";
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
        <Row title="Origem" detail={SOURCE_LABEL[appt.source]} />
        {appt.notes ? <Row title={appt.notes} tone="muted" numberOfLines={0} /> : null}
      </Section>

      {/* Pagamento: sinal, restante e devoluções, registrados pela Gabi. */}
      <Section header="Pagamento">
        <Row title="Valor" detail={formatMoney(appt.price_cents)} />
        <Row
          title="Situação"
          detail={
            <Text style={{ color: pay.label === "Pago" ? theme.green : pay.label === "Sinal" ? theme.accent : theme.label2, fontWeight: "600" }}>
              {pay.label === "Pago"
                ? "Pago ✓"
                : pay.label === "Sinal"
                  ? `Sinal ${formatMoney(appt.paid_cents)} · falta ${formatMoney(pay.remaining)}`
                  : "Não pago"}
            </Text>
          }
        />
        {data!.payments.map((p) => (
          <Row
            key={p.id}
            title={PAYMENT_KIND_LABEL[p.kind]}
            subtitle={`${formatInTz(p.paid_at, "dd/MM/yyyy", tz)} · ${PAYMENT_METHOD_LABEL[p.method]}`}
            detail={<Text style={{ color: p.amount_cents < 0 ? theme.red : theme.label }}>{formatMoney(p.amount_cents)}</Text>}
          />
        ))}
        {!paying && (active || pay.remaining > 0) && (
          <Row leading={<RowIcon name="tag" />} title="Registrar pagamento" tone="accent" onPress={openPayForm} />
        )}
      </Section>
      {paying && (
        <View style={{ marginTop: -16, marginBottom: 28 }}>
          <Section footer={pay.remaining > 0 ? `Falta receber ${formatMoney(pay.remaining)}.` : undefined}>
            <FormRow label="Valor recebido">
              <Input value={payValue} onChangeText={setPayValue} placeholder="R$ 0,00" keyboardType="decimal-pad" autoFocus />
            </FormRow>
            <PickerRow label="Forma" value={payMethod} onChange={setPayMethod} options={METHOD_OPTIONS} />
          </Section>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="Cancelar" variant="tinted" style={{ flex: 1 }} onPress={() => setPaying(false)} />
            <Button title="Salvar pagamento" style={{ flex: 1 }} loading={busy} onPress={savePayment} />
          </View>
        </View>
      )}

      {appt.clients && (
        <Section>
          <Row
            leading={<RowIcon name="message" />}
            // Pendente: pede a confirmação; depois de confirmado, só abre a conversa.
            title={appt.status === "pending" ? "Pedir confirmação no WhatsApp" : "Enviar mensagem no WhatsApp"}
            chevron
            onPress={() =>
              Linking.openURL(
                appt.status === "pending"
                  ? confirmationRequestLink(appt, tz)!
                  : whatsappLink(appt.clients!.phone, `Olá, ${appt.clients!.name.split(" ")[0]}! Aqui é a Gabi.`),
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

      {!ask && (
        <Section>
          {active ? (
            [
              <Row
                key="e"
                leading={<RowIcon name="pencil" />}
                title="Editar agendamento"
                chevron
                onPress={() => router.push({ pathname: "/agenda/novo", params: { id: appt.id } })}
              />,
              appt.status === "pending" && (
                <Row key="ok" leading={<RowIcon name="check" />} title="Marcar como confirmado" onPress={() => setStatus("confirmed")} />
              ),
              <Row key="c" leading={<RowIcon name="check" />} title="Concluir atendimento" onPress={complete} />,
              <Row key="n" leading={<RowIcon name="noShow" />} title="Cliente não compareceu" onPress={() => setStatus("no_show")} />,
              <Row key="x" leading={<RowIcon name="cancel" tone="destructive" />} title="Cancelar agendamento" tone="destructive" onPress={cancel} />,
            ]
          ) : (
            // Reaberto volta a precisar de confirmação.
            <Row leading={<RowIcon name="reopen" />} title="Reabrir agendamento" onPress={() => setStatus("pending")} />
          )}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 28, borderCurve: "continuous" },
});
