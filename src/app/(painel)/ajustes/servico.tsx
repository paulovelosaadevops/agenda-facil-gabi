import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";
import { Icon } from "@/components/icon";
import { PickerRow } from "@/components/picker-row";
import { ScreenHeader } from "@/components/screen-header";
import { Banner, FormRow, HeaderButton, Input, Row, Screen, Section, SwitchRow, Text, TextAreaRow } from "@/components/ui";
import { formatDuration, formatMoney, parseMoney } from "@shared/format.ts";
import { SERVICE_CATEGORIES, type Service, type ServiceCategory } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { confirmAction } from "@/lib/confirm";
import { dbErrorMessage, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { invalidate, useQuery } from "@/lib/use-query";

const DURATIONS = [15, 20, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300];
const RETURN_DAYS = [7, 10, 14, 15, 20, 21, 25, 28, 30, 45, 60, 90];
const NOTICE_DAYS = [0, 1, 2, 3, 5, 7];
const withCurrent = (values: number[], current: number) => (values.includes(current) ? values : [...values, current].sort((a, b) => a - b));
const toPrice = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export default function ServiceForm() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [combo, setCombo] = useState<string[]>([]);
  const [isCombo, setIsCombo] = useState(false);
  const [category, setCategory] = useState<ServiceCategory>("primeira");
  const [feet, setFeet] = useState(false);
  const [hasMaintenance, setHasMaintenance] = useState(false);
  const [returnDays, setReturnDays] = useState(21);
  const [noticeDays, setNoticeDays] = useState(1);
  const [returnService, setReturnService] = useState<string>("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const { data: others } = useQuery(async () => {
    const { data: all } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .eq("archived", false)
      .order("name")
      .returns<Service[]>();
    const current = all?.find((s) => s.id === id);
    if (current) {
      setName(current.name);
      setDuration(current.duration_min);
      setPrice(toPrice(current.price_cents));
      setDescription(current.description);
      setActive(current.active);
      setCombo(current.combo_service_ids ?? []);
      setIsCombo((current.combo_service_ids ?? []).length > 0);
      setCategory(current.category ?? "outros");
      setFeet(current.feet ?? false);
      setHasMaintenance(current.maintenance_days != null);
      setReturnDays(current.maintenance_days ?? 21);
      setNoticeDays(current.maintenance_notice_days);
      setReturnService(current.maintenance_service_id ?? "");
    }
    return (all ?? []).filter((s) => s.id !== id);
  }, [id]);

  const comboServices = (others ?? []).filter((s) => combo.includes(s.id));
  const comboSum = comboServices.reduce((acc, s) => ({ min: acc.min + s.duration_min, cents: acc.cents + s.price_cents }), { min: 0, cents: 0 });

  const toggleCombo = (serviceId: string) =>
    setCombo((list) => (list.includes(serviceId) ? list.filter((x) => x !== serviceId) : [...list, serviceId]));

  const save = async () => {
    if (name.trim().length < 2) return setError("Informe o nome do serviço.");
    if (parseMoney(price) <= 0) return setError("Informe o valor do serviço.");
    if (isCombo && combo.length < 2) return setError("Marque pelo menos 2 serviços para o combo.");
    setSaving(true);
    const row = {
      name: name.trim(),
      duration_min: duration,
      price_cents: parseMoney(price),
      description: description.trim(),
      active,
      combo_service_ids: isCombo ? combo : [],
      category,
      feet,
      maintenance_days: hasMaintenance ? returnDays : null,
      maintenance_notice_days: noticeDays,
      maintenance_service_id: hasMaintenance && returnService ? returnService : null,
    };
    const { error: e } = id
      ? await supabase.from("services").update(row).eq("id", id).eq("business_id", business.id)
      : await supabase.from("services").insert({ ...row, business_id: business.id });
    setSaving(false);
    if (e) return setError(dbErrorMessage(e));
    invalidate();
    router.back();
  };

  const remove = async () => {
    if (!id) return;
    const ok = await confirmAction("Excluir serviço?", `“${name}” deixa de aparecer para as clientes e na sua lista.`, "Excluir");
    if (!ok) return;
    const { error: e } = await supabase.from("services").delete().eq("id", id).eq("business_id", business.id);
    // Com atendimentos no histórico não dá para apagar de vez: arquiva (some de tudo, mas o histórico fica).
    if (e?.code === "23503") {
      const { error: archiveError } = await supabase.from("services").update({ archived: true, active: false }).eq("id", id);
      if (archiveError) return setError(dbErrorMessage(archiveError));
    } else if (e) {
      return setError(dbErrorMessage(e));
    }
    invalidate();
    router.back();
  };

  const durations = withCurrent(DURATIONS, duration);

  return (
    <Screen keyboard>
      <ScreenHeader
        title={id ? "Editar serviço" : "Novo serviço"}
        left={<HeaderButton icon="close" accessibilityLabel="Cancelar" onPress={() => router.back()} />}
        right={<HeaderButton title={saving ? "Salvando…" : "Salvar"} bold onPress={save} />}
      />
      {error && <Banner>{error}</Banner>}

      <Section>
        <FormRow label="Nome">
          <Input value={name} onChangeText={setName} placeholder="Ex.: Blindagem" />
        </FormRow>
        <FormRow label="Valor">
          <Input value={price} onChangeText={setPrice} placeholder="R$ 0,00" keyboardType="decimal-pad" />
        </FormRow>
        <PickerRow label="Tempo de atendimento" value={duration} onChange={setDuration} options={durations.map((d) => ({ label: formatDuration(d), value: d }))} />
      </Section>

      <Section header="Categoria" footer="Separa a lista de serviços aqui e no agendamento das clientes.">
        {SERVICE_CATEGORIES.map((c) => (
          <Row
            key={c.key}
            title={c.label}
            onPress={() => setCategory(c.key)}
            trailing={category === c.key ? <Icon name="check" size={18} color={theme.accent} weight="semibold" /> : undefined}
          />
        ))}
      </Section>

      <Section header="Detalhes" footer="Aparece para as clientes ao escolher o serviço.">
        <TextAreaRow value={description} onChangeText={setDescription} placeholder="O que está incluso, cuidados, durabilidade..." />
      </Section>

      <Section footer="Serviço de pés: só aparece para as clientes marcadas como “Faz pés” no cadastro delas.">
        <SwitchRow label="Serviço de pés" value={feet} onValueChange={setFeet} />
      </Section>

      <Section footer="Serviços ocultos não aparecem para as clientes, mas você ainda pode agendá-los.">
        <SwitchRow label="Visível para as clientes" value={active} onValueChange={setActive} />
      </Section>

      <Section
        header="Combo"
        footer={
          !isCombo
            ? "Junte serviços que a cliente faz no mesmo horário (ex.: Mão + Pé)."
            : combo.length >= 2
              ? `Soma dos serviços: ${formatDuration(comboSum.min)} · ${formatMoney(comboSum.cents)}. Você pode dar um valor especial ao combo.`
              : "Marque os serviços que fazem parte deste combo."
        }
      >
        <SwitchRow label="É um combo" value={isCombo} onValueChange={setIsCombo} />
        {isCombo && (others ?? []).filter((s) => s.combo_service_ids.length === 0).map((s) => (
          <Row
            key={s.id}
            title={s.name}
            subtitle={`${formatDuration(s.duration_min)} · ${formatMoney(s.price_cents)}`}
            onPress={() => toggleCombo(s.id)}
            trailing={combo.includes(s.id) ? <Icon name="check" size={18} color={theme.accent} weight="semibold" /> : undefined}
          />
        ))}
      </Section>
      {isCombo && combo.length >= 2 && (
        <Pressable
          onPress={() => {
            setDuration(comboSum.min);
            setPrice(toPrice(comboSum.cents));
          }}
          style={{ marginTop: -18, marginBottom: 28, paddingHorizontal: 16 }}
        >
          <Text variant="footnote" color="accent" style={{ fontWeight: "600" }}>
            Usar a soma no tempo e no valor
          </Text>
        </Pressable>
      )}

      <Section
        header="Manutenção"
        footer={
          hasMaintenance
            ? `A cliente e você recebem um aviso ${noticeDays ? `${noticeDays} dia${noticeDays > 1 ? "s" : ""} antes` : "no dia"} do retorno (dia ${returnDays - noticeDays} após o atendimento).`
            : "Para serviços com retorno (ex.: alongamento → manutenção em 21 dias)."
        }
      >
        <SwitchRow label="Pede retorno para manutenção" value={hasMaintenance} onValueChange={setHasMaintenance} />
        {hasMaintenance && (
          <PickerRow
            label="Retorno em"
            value={returnDays}
            onChange={setReturnDays}
            options={withCurrent(RETURN_DAYS, returnDays).map((d) => ({ label: `${d} dias`, value: d }))}
          />
        )}
        {hasMaintenance && (
          <PickerRow
            label="Serviço do retorno"
            value={returnService}
            onChange={setReturnService}
            options={[
              { label: "Este mesmo", value: "" },
              // Serviços de manutenção primeiro: são os candidatos naturais ao retorno.
              ...[...(others ?? [])]
                .sort((a, b) => Number(b.category === "manutencao") - Number(a.category === "manutencao"))
                .map((s) => ({ label: s.name, value: s.id })),
            ]}
          />
        )}
        {hasMaintenance && (
          <PickerRow
            label="Avisar"
            value={noticeDays}
            onChange={setNoticeDays}
            options={NOTICE_DAYS.filter((d) => d < returnDays).map((d) => ({ label: d ? `${d} dia${d > 1 ? "s" : ""} antes` : "No dia", value: d }))}
          />
        )}
      </Section>

      {id && (
        <Section>
          <Pressable
            onPress={remove}
            style={({ pressed }) => ({ minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? theme.fill : undefined })}
          >
            <Text color="red">Excluir serviço</Text>
          </Pressable>
        </Section>
      )}
    </Screen>
  );
}
