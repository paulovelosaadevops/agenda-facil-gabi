import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScreenHeader } from "@/components/screen-header";
import { Banner, FormRow, HeaderButton, Input, Screen, Section, SwitchRow, TextAreaRow } from "@/components/ui";
import { formatPhone, normalizePhone } from "@shared/format.ts";
import type { Client } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { dbErrorMessage, supabase } from "@/lib/supabase";
import { invalidate, useQuery } from "@/lib/use-query";

/** "dd/mm/aaaa" ↔ "aaaa-mm-dd" */
const toIso = (br: string) => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const toBr = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

export default function ClientForm() {
  const router = useRouter();
  const business = useBusiness();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState({ name: "", phone: "", instagram: "", email: "", birthday: "", notes: "" });
  const [whatsapp, setWhatsapp] = useState(true);
  const [feet, setFeet] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  useQuery(async () => {
    if (!id) return null;
    const { data } = await supabase.from("clients").select("*").eq("id", id).eq("business_id", business.id).maybeSingle<Client>();
    if (data) {
      setForm({
        name: data.name,
        phone: formatPhone(data.phone),
        instagram: data.instagram,
        email: data.email ?? "",
        birthday: toBr(data.birthday),
        notes: data.notes,
      });
      setWhatsapp(data.whatsapp);
      setFeet(data.feet);
    }
    return data;
  }, [id]);

  const save = async () => {
    setError(undefined);
    const phone = normalizePhone(form.phone);
    if (form.name.trim().length < 2) return setError("Informe o nome.");
    if (!phone) return setError("Telefone inválido. Use DDD + número.");
    // Regra do estúdio: todos os dados são obrigatórios.
    if (form.instagram.trim().length < 2) return setError("Informe o Instagram.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Informe um e-mail válido.");
    const birthday = form.birthday ? toIso(form.birthday) : null;
    if (form.birthday && !birthday) return setError("Aniversário no formato dd/mm/aaaa.");

    setSaving(true);
    const row = {
      name: form.name.trim(),
      phone,
      whatsapp,
      feet,
      instagram: form.instagram.trim().replace(/^@?/, "@"),
      email: form.email.trim().toLowerCase(),
      birthday,
      notes: form.notes.trim(),
    };
    const result = id
      ? await supabase.from("clients").update(row).eq("id", id).eq("business_id", business.id).select("id").single()
      : await supabase.from("clients").insert({ ...row, business_id: business.id }).select("id").single();
    setSaving(false);
    if (result.error) {
      return setError(result.error.code === "23505" ? "Já existe uma cliente com esse telefone ou e-mail." : dbErrorMessage(result.error));
    }
    invalidate();
    if (id) router.back();
    else router.replace(`/clientes/${result.data.id}`);
  };

  return (
    <Screen keyboard>
      <ScreenHeader
        title={id ? "Editar cliente" : "Nova cliente"}
        left={<HeaderButton icon="close" accessibilityLabel="Cancelar" onPress={() => router.back()} />}
        right={<HeaderButton title={saving ? "Salvando…" : "Salvar"} bold onPress={save} />}
      />
      {error && <Banner>{error}</Banner>}
      <Section header="Dados obrigatórios">
        <FormRow label="Nome">
          <Input value={form.name} onChangeText={set("name")} placeholder="Nome completo" textContentType="name" />
        </FormRow>
        <FormRow label="Telefone">
          <Input value={form.phone} onChangeText={set("phone")} placeholder="(11) 99999-8888" keyboardType="phone-pad" />
        </FormRow>
        <SwitchRow label="Este número é WhatsApp" value={whatsapp} onValueChange={setWhatsapp} />
        <FormRow label="Instagram">
          <Input value={form.instagram} onChangeText={set("instagram")} placeholder="@perfil" autoCapitalize="none" autoCorrect={false} />
        </FormRow>
        <FormRow label="E-mail">
          <Input value={form.email} onChangeText={set("email")} placeholder="cliente@email.com" keyboardType="email-address" autoCapitalize="none" />
        </FormRow>
      </Section>
      <Section footer="Libera os serviços de pés para esta cliente agendar pelo link e pelo painel dela.">
        <SwitchRow label="Faz pés com você" value={feet} onValueChange={setFeet} />
      </Section>
      <Section header="Opcional">
        <FormRow label="Aniversário">
          <Input value={form.birthday} onChangeText={set("birthday")} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
        </FormRow>
      </Section>
      <Section header="Observações" footer="Preferências, alergias, formato e cores favoritas.">
        <TextAreaRow value={form.notes} onChangeText={set("notes")} placeholder="Anotações sobre a cliente" />
      </Section>
    </Screen>
  );
}
