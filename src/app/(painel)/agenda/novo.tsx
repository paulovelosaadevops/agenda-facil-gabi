import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { ClientPicker } from "@/components/client-picker";
import { DateField } from "@/components/date-calendar";
import { GroupedPickerRow } from "@/components/grouped-picker";
import { ScreenHeader } from "@/components/screen-header";
import { timeOptions, TimeSelect } from "@/components/time-select";
import { Banner, Button, FormRow, HeaderButton, Input, Loading, Screen, Section, SwitchRow, Text, TextAreaRow } from "@/components/ui";
import { dayBounds, toDateKey } from "@shared/availability.ts";
import { formatDuration, formatInTz, formatMoney } from "@shared/format.ts";
import { SERVICE_CATEGORIES, type Client, type Service } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { callFunction, supabase } from "@/lib/supabase";
import { invalidate, useQuery } from "@/lib/use-query";
import { useSlotSuggestions } from "@/lib/use-slot-suggestions";

type ClientOption = Pick<Client, "id" | "name" | "phone">;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const serviceMeta = (s: Service) => `${formatDuration(s.duration_min)} · ${formatMoney(s.price_cents)}`;

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
  // No computador: cliente e serviço à esquerda, data e horário à direita.
  const wide = useWindowDimensions().width >= 900;
  const params = useLocalSearchParams<{ data?: string; cliente?: string; servico?: string }>();
  const [query, setQuery] = useState("");
  const [client, setClient] = useState<ClientOption>();

  const { data } = useQuery(async () => {
    const [clients, services] = await Promise.all([
      supabase.from("clients").select("id, name, phone").eq("business_id", business.id).order("name").returns<ClientOption[]>(),
      supabase.from("services").select("*").eq("business_id", business.id).eq("active", true).order("name").returns<Service[]>(),
    ]);
    const preset = clients.data?.find((c) => c.id === params.cliente);
    if (preset) {
      // Veio da ficha da cliente: já deixa selecionada.
      setClient(preset);
      setQuery(preset.name);
    }
    return { clients: clients.data ?? [], services: services.data ?? [] };
  });

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
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const slots = useSlotSuggestions(business, serviceId, date);
  const isNewClient = !client && query.trim().length > 0;

  const services = data?.services ?? [];
  const service = services.find((s) => s.id === serviceId);
  // Dropdown separado por categoria (Primeira aplicação, Manutenção, Outros serviços).
  const groups = SERVICE_CATEGORIES.map((c) => ({
    label: c.label,
    options: services.filter((s) => (s.category ?? "outros") === c.key).map((s) => ({ label: s.name, detail: serviceMeta(s), value: s.id })),
  })).filter((g) => g.options.length);
  const dateLabel = capitalize(formatInTz(dayBounds(date, tz).start, "EEEE, d 'de' MMMM", tz));
  const clientName = client?.name ?? query.trim();

  const save = async () => {
    setError(undefined);
    if (!client && query.trim().length < 2) return setError("Escolha ou digite o nome da cliente.");
    if (!client && (!phone.trim() || instagram.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()))) {
      return setError("Cliente nova: preencha telefone, Instagram e e-mail.");
    }
    if (!serviceId) return setError("Escolha um serviço.");
    if (!time) return setError("Escolha o horário.");
    setSaving(true);
    try {
      await callFunction("panel", {
        action: "create-appointment",
        clientId: client?.id,
        newClient: client
          ? undefined
          : { name: query.trim(), phone, whatsapp, instagram: instagram.trim().replace(/^@?/, "@"), email: email.trim().toLowerCase() },
        serviceId,
        date,
        time,
        notes,
        notify,
      });
      invalidate();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível agendar.");
      setSaving(false);
    }
  };

  const who = (
    <>
      <Section header="Cliente" footer={isNewClient ? "Cliente nova: todos os dados são obrigatórios." : undefined}>
        <ClientPicker clients={data?.clients ?? []} query={query} onQueryChange={setQuery} selected={client} onSelect={setClient} />
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

      <Section header="Serviço" footer={service ? serviceMeta(service) : undefined}>
        <GroupedPickerRow
          label="Serviço"
          value={serviceId}
          groups={groups}
          onChange={(id) => {
            setServiceId(id);
            setTime("");
          }}
        />
      </Section>
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
          min={params.data && params.data < today ? params.data : today}
          today={today}
          value={date}
          label={dateLabel}
          collapsible={!wide}
          onChange={(d) => {
            setDate(d);
            setTime("");
          }}
        />
      </View>

      {/* No celular o dia já aparece no campo recolhido acima. */}
      {wide && (
        <Text variant="headline" style={{ marginBottom: 10, marginHorizontal: 4 }}>
          {dateLabel}
        </Text>
      )}
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
        <SwitchRow label="Confirmar no WhatsApp" value={notify} onValueChange={setNotify} />
      </Section>

      {/* Resumo do que vai ser marcado, logo acima do botão. */}
      {clientName && service && time ? (
        <Text variant="subhead" color="label2" style={{ marginBottom: 12, marginHorizontal: 4 }}>
          {clientName} · {service.name} · {dateLabel.split(",")[0]}, {formatInTz(dayBounds(date, tz).start, "dd/MM", tz)} às {time}
        </Text>
      ) : null}
      {error && <Banner>{error}</Banner>}
      <Button title={time ? `Agendar às ${time}` : "Agendar"} onPress={save} loading={saving} />
    </>
  );

  return (
    <Screen keyboard>
      <ScreenHeader title="Novo agendamento" left={<HeaderButton icon="close" accessibilityLabel="Cancelar" onPress={() => router.back()} />} />
      {wide ? (
        <View style={{ flexDirection: "row", gap: 32, alignItems: "flex-start" }}>
          <View style={{ flex: 1, minWidth: 0 }}>{who}</View>
          <View style={{ flex: 1, minWidth: 0, maxWidth: 480 }}>{when}</View>
        </View>
      ) : (
        <>
          {who}
          {when}
        </>
      )}
    </Screen>
  );
}
