import { useState } from "react";
import { ScreenHeader } from "@/components/screen-header";
import { publicBookingUrl } from "@/components/share-link";
import { Banner, FormRow, HeaderButton, Input, Row, Screen, Section } from "@/components/ui";
import { formatPhone, normalizePhone } from "@shared/format.ts";
import { useBusiness } from "@/lib/auth";
import { useSaveBusiness } from "@/lib/use-save-business";

export default function StudioSettings() {
  const business = useBusiness();
  const { save, saving, error, setError } = useSaveBusiness();
  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone ? formatPhone(business.phone) : "");
  const [address, setAddress] = useState(business.address ?? "");

  const submit = () => {
    if (name.trim().length < 2) return setError("Informe o nome do estúdio.");
    const normalized = phone ? normalizePhone(phone) : null;
    if (phone && !normalized) return setError("WhatsApp inválido. Use DDD + número.");
    void save({ name: name.trim(), phone: normalized, address: address.trim() || null });
  };

  return (
    <Screen keyboard>
      <ScreenHeader title="Estúdio" right={<HeaderButton title={saving ? "Salvando…" : "Salvar"} bold onPress={submit} />} />
      {error && <Banner>{error}</Banner>}
      <Section>
        <FormRow label="Nome">
          <Input value={name} onChangeText={setName} />
        </FormRow>
        <FormRow label="WhatsApp">
          <Input value={phone} onChangeText={setPhone} placeholder="(11) 99999-8888" keyboardType="phone-pad" />
        </FormRow>
        <FormRow label="Endereço">
          <Input value={address} onChangeText={setAddress} placeholder="Rua, número, bairro" />
        </FormRow>
      </Section>
      <Section footer="O endereço aparece na página de agendamento e nas confirmações enviadas às clientes.">
        <Row title="Link" detail={publicBookingUrl().replace(/^https?:\/\//, "")} />
        <Row title="Fuso horário" detail="Brasília" />
      </Section>
    </Screen>
  );
}
