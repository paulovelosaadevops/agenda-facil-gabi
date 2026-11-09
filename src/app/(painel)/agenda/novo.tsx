import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ClientPicker, NEW_CLIENT } from "@/components/client-picker";
import { DateField } from "@/components/date-calendar";
import { GroupedPickerRow } from "@/components/grouped-picker";
import { PickerRow } from "@/components/picker-row";
import { ScreenHeader } from "@/components/screen-header";
import { Segmented } from "@/components/segmented";
import { timeOptions, TimeSelect } from "@/components/time-select";
import { Banner, Button, FormRow, HeaderButton, Input, Loading, Row, Screen, Section, SwitchRow, Text, TextAreaRow } from "@/components/ui";
import { dayBounds, toDateKey } from "@shared/availability.ts";
import { formatDuration, formatInTz, formatMoney, parseMoney } from "@shared/format.ts";
import { PAYMENT_METHOD_LABEL, SERVICE_CATEGORIES, type Client, type PaymentMethod, type Service } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { callFunction, supabase } from "@/lib/supabase";
import { invalidate, useQuery } from "@/lib/use-query";
import { useSlotSuggestions } from "@/lib/use-slot-suggestions";

type ClientOption = Pick<Client, "id" | "name" | "phone">;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const serviceMeta = (s: Service) => `${formatDuration(s.duration_min)} · ${formatMoney(s.price_cents)}${s.active ? "" : " · só no painel"}`;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const PERIODS = [
  { label: "Manhã", test: (t: string) => t < "12:00" },
  { label: "Tarde", test: (t: string) => t >= "12:00" && t < "18:00" },
  { label: "Noite", test: (t: string) => t >= "18:00" },
];

/** Horários livres para o dropdown: por período do dia, com a hora prevista de término. */
const slotGroups = (slots: string[], durationMin: number) =>
  PERIODS.map((p) => ({
    label: p.label,
    options: slots.filter(p.test).map((t) => ({ label: t, detail: `termina às ${toTime(toMin(t) + durationMin)}`, value: t })),
  })).filter((g) => g.options.length);

export default function NewAppointment() {
  const router = useRouter();
  const business = useBusiness();
  const tz = business.timezone;
  // ?id=: editar um agendamento existente (a cliente fica fixa).
  const params = useLocalSearchParams<{ data?: string; cliente?: string; servico?: string; id?: string }>();
  const editingId = params.id;
  // Id da cliente escolhida no dropdown, NEW_CLIENT para cadastrar na hora, ou "" (nenhuma).
  // Veio da ficha da cliente (?cliente=): já começa com ela selecionada.
  const [clientChoice, setClientChoice] = useState(params.cliente ?? "");
  const [newName, setNewName] = useState("");
  const today = toDateKey(new Date(), tz);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState(params.servico ?? "");
  const [date, setDate] = useState(params.data ?? today);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [promo, setPromo] = useState(false);
  const [promoValue, setPromoValue] = useState("");
  // Pagamento antecipado (só ao criar): integral ou sinal, com a forma de pagamento.
  const [prepaid, setPrepaid] = useState(false);
  const [prepaidFull, setPrepaidFull] = useState(false);
  const [depositValue, setDepositValue] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("pix");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const { data } = useQuery(async () => {
    const [clients, services, editing] = await Promise.all([
      supabase.from("clients").select("id, name, phone").eq("business_id", business.id).order("name").returns<ClientOption[]>(),
      // Todos os não excluídos: a Gabi agenda também os que não aparecem para as clientes (ex.: serviço de uma cliente só).
      supabase.from("services").select("*").eq("business_id", business.id).eq("archived", false).order("name").returns<Service[]>(),
      editingId
        ? supabase
            .from("appointments")
            .select("client_id, service_id, starts_at, price_cents, notes, services(price_cents)")
            .eq("id", editingId)
            .eq("business_id", business.id)
            .maybeSingle<{ client_id: string; service_id: string; starts_at: string; price_cents: number; notes: string; services: { price_cents: number } | null }>()
        : Promise.resolve({ data: null }),
    ]);
    const appt = editing.data;
    if (appt) {
      // Editando: preenche o formulário com o agendamento.
      setClientChoice(appt.client_id);
      setServiceId(appt.service_id);
      setDate(toDateKey(new Date(appt.starts_at), tz));
      setTime(formatInTz(appt.starts_at, "HH:mm", tz));
      setNotes(appt.notes);
      if (appt.services && appt.price_cents !== appt.services.price_cents) {
        setPromo(true);
        setPromoValue((appt.price_cents / 100).toFixed(2).replace(".", ","));
      }
    }
    return { clients: clients.data ?? [], services: services.data ?? [], editingDate: appt ? toDateKey(new Date(appt.starts_at), tz) : undefined };
  }, [editingId]);
  const client = data?.clients.find((c) => c.id === clientChoice);
  const slots = useSlotSuggestions(business, serviceId, date, editingId);
  const isNewClient = clientChoice === NEW_CLIENT;

  const services = data?.services ?? [];
  const service = services.find((s) => s.id === serviceId);
  // Dropdown separado por categoria (Primeira aplicação, Manutenção, Outros serviços).
  const groups = SERVICE_CATEGORIES.map((c) => ({
    label: c.label,
    options: services.filter((s) => (s.category ?? "outros") === c.key).map((s) => ({ label: s.name, detail: serviceMeta(s), value: s.id })),
  })).filter((g) => g.options.length);
  const dateLabel = capitalize(formatInTz(dayBounds(date, tz).start, "EEEE, d 'de' MMMM", tz));
  const clientName = client?.name ?? (isNewClient ? newName.trim() : "");
  // Só com "Valor promocional?" marcado o valor informado vale; senão, o preço do serviço.
  const promoCents = promo && /\d/.test(promoValue) ? parseMoney(promoValue) : undefined;

  const save = async () => {
    setError(undefined);
    if (!client && !isNewClient) return setError("Escolha a cliente.");
    if (isNewClient && newName.trim().length < 2) return setError("Cliente nova: informe o nome.");
    if (isNewClient && (!phone.trim() || instagram.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()))) {
      return setError("Cliente nova: preencha telefone, Instagram e e-mail.");
    }
    if (!serviceId) return setError("Escolha um serviço.");
    if (promo && !/\d/.test(promoValue)) return setError("Informe o valor promocional.");
    if (!editingId && prepaid && !prepaidFull && !(parseMoney(depositValue) > 0)) return setError("Informe o valor do sinal.");
    if (!time) return setError("Escolha o horário.");
    setSaving(true);
    try {
      if (editingId) {
        await callFunction("panel", { action: "update-appointment", appointmentId: editingId, serviceId, date, time, notes, priceCents: promoCents });
        invalidate();
        router.back();
        return;
      }
      await callFunction("panel", {
        action: "create-appointment",
        clientId: client?.id,
        newClient: client
          ? undefined
          : { name: newName.trim(), phone, whatsapp, instagram: instagram.trim().replace(/^@?/, "@"), email: email.trim().toLowerCase() },
        serviceId,
        date,
        time,
        notes,
        notify,
        priceCents: promoCents,
        payment: prepaid ? { full: prepaidFull, amountCents: prepaidFull ? undefined : parseMoney(depositValue), method: payMethod } : undefined,
      });
      invalidate();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "Não foi possível salvar." : "Não foi possível agendar.");
      setSaving(false);
    }
  };

  const who = (
    <>
      <Section header="Cliente" footer={isNewClient ? "Cliente nova: todos os dados são obrigatórios." : undefined}>
        {/* Editando: a cliente não muda (outra cliente = outro agendamento). */}
        {editingId ? (
          <Row title="Cliente" detail={client?.name ?? "…"} />
        ) : (
          <ClientPicker clients={data?.clients ?? []} value={clientChoice} onChange={setClientChoice} />
        )}
        {isNewClient && (
          <FormRow label="Nome">
            <Input value={newName} onChangeText={setNewName} placeholder="Nome e sobrenome" autoFocus />
          </FormRow>
        )}
        {isNewClient && (
          <FormRow label="Telefone">
            <Input value={phone} onChangeText={setPhone} placeholder="(11) 99999-8888" keyboardType="phone-pad" />
          </FormRow>
        )}
        {isNewClient && <SwitchRow label="Este número é WhatsApp" value={whatsapp} onValueChange={setWhatsapp} />}
        {isNewClient && (
          <FormRow label="Instagram">
            <Input value={instagram} onChangeText={setInstagram} placeholder="@perfil" autoCapitalize="none" autoCorrect={false} />
          </FormRow>
        )}
        {isNewClient && (
          <FormRow label="E-mail">
            <Input value={email} onChangeText={setEmail} placeholder="cliente@email.com" keyboardType="email-address" autoCapitalize="none" />
          </FormRow>
        )}
      </Section>

      <Section
        header="Serviço"
        footer={
          promo && service
            ? `Vale só neste agendamento, no lugar de ${formatMoney(service.price_cents)}. É o valor usado no lucro.`
            : service
              ? serviceMeta(service)
              : undefined
        }
      >
        <GroupedPickerRow
          label="Serviço"
          value={serviceId}
          groups={groups}
          onChange={(id) => {
            setServiceId(id);
            setTime("");
          }}
        />
        {/* Promoção: só com a opção marcada o valor informado substitui o preço do serviço. */}
        <SwitchRow label="Valor promocional?" value={promo} onValueChange={setPromo} />
        {promo && (
          <FormRow label="Valor">
            <Input
              value={promoValue}
              onChangeText={setPromoValue}
              placeholder={service ? formatMoney(service.price_cents) : "R$ 0,00"}
              keyboardType="decimal-pad"
              autoFocus
            />
          </FormRow>
        )}
      </Section>

      {/* Pagamento antecipado (só ao criar; depois, registra pelo detalhe do agendamento). */}
      {!editingId && (
        <Section
          header="Pagamento"
          footer={
            prepaid
              ? prepaidFull
                ? `Fica registrado como pago: ${formatMoney(promoCents ?? service?.price_cents ?? 0)}.`
                : "O restante pode ser registrado depois, no detalhe do agendamento."
              : "Se a cliente já pagou tudo ou um sinal para reservar o dia."
          }
        >
          <SwitchRow label="Pagamento antecipado?" value={prepaid} onValueChange={setPrepaid} />
          {prepaid && (
            <>
              <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                <Segmented values={["Sinal", "Pago integral"]} selectedIndex={prepaidFull ? 1 : 0} onChange={(i) => setPrepaidFull(i === 1)} />
              </View>
              {!prepaidFull && (
                <FormRow label="Valor do sinal">
                  <Input value={depositValue} onChangeText={setDepositValue} placeholder="R$ 0,00" keyboardType="decimal-pad" />
                </FormRow>
              )}
              <PickerRow
                label="Forma"
                value={payMethod}
                onChange={setPayMethod}
                options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ label: PAYMENT_METHOD_LABEL[m], value: m }))}
              />
            </>
          )}
        </Section>
      )}
    </>
  );

  const when = (
    <>
      <Text variant="overline" color="label2" style={{ marginBottom: 6, marginHorizontal: 16 }}>
        QUANDO
      </Text>
      <View style={{ marginBottom: 20 }}>
        {/* Veio de um dia passado da agenda (encaixe retroativo): esse dia continua selecionável. */}
        <DateField
          min={[params.data, data?.editingDate, today].filter((d): d is string => Boolean(d)).sort()[0]}
          today={today}
          value={date}
          label={dateLabel}
          // Formulário flutuante (uma coluna): o dia fica recolhido, com Hoje/Amanhã e "Trocar".
          collapsible
          onChange={(d) => {
            setDate(d);
            setTime("");
          }}
        />
      </View>

      <View style={{ marginBottom: 20 }}>
        {!serviceId ? (
          <Banner tone="info">Escolha o serviço para ver os horários livres.</Banner>
        ) : !slots ? (
          <Loading />
        ) : slots.length ? (
          <Section style={{ marginBottom: 0 }}>
            <GroupedPickerRow label="Horário" value={slots.includes(time) ? time : ""} groups={slotGroups(slots, service?.duration_min ?? 0)} onChange={setTime} />
          </Section>
        ) : (
          <Banner tone="info">Nenhum horário livre no expediente deste dia.</Banner>
        )}
      </View>
      <Section footer="Para encaixar fora dos horários livres.">
        <FormRow label="Outro horário">
          <TimeSelect value={slots?.includes(time) ? "" : time} onChange={setTime} title="Outro horário" options={timeOptions("06:00", "22:00", 15)} />
        </FormRow>
      </Section>

      <Section>
        <TextAreaRow value={notes} onChangeText={setNotes} placeholder="Observações" />
        {!editingId && <SwitchRow label="Confirmar no WhatsApp" value={notify} onValueChange={setNotify} />}
      </Section>

      {/* Resumo do que vai ser marcado, logo acima do botão. */}
      {clientName && service && time ? (
        <Text variant="subhead" color="label2" style={{ marginBottom: 12, marginHorizontal: 4 }}>
          {clientName} · {service.name} · {dateLabel.split(",")[0]}, {formatInTz(dayBounds(date, tz).start, "dd/MM", tz)} às {time} ·{" "}
          {formatMoney(promoCents ?? service.price_cents)}
          {promoCents !== undefined ? " (promocional)" : ""}
          {!editingId && prepaid ? (prepaidFull ? " · já pago" : parseMoney(depositValue) > 0 ? ` · sinal ${formatMoney(parseMoney(depositValue))}` : "") : ""}
        </Text>
      ) : null}
      {error && <Banner>{error}</Banner>}
      <Button title={editingId ? "Salvar alterações" : time ? `Agendar às ${time}` : "Agendar"} onPress={save} loading={saving} />
    </>
  );

  return (
    <Screen keyboard>
      <ScreenHeader title={editingId ? "Editar agendamento" : "Novo agendamento"} left={<HeaderButton icon="close" accessibilityLabel="Cancelar" onPress={() => router.back()} />} />
      {who}
      {when}
    </Screen>
  );
}
