import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";
import { CreatePassword } from "@/components/create-password";
import { ScreenHeader } from "@/components/screen-header";
import { Banner, FormRow, HeaderButton, Input, Row, Screen, Section, SwitchRow, Text } from "@/components/ui";
import { formatPhone, normalizePhone } from "@shared/format.ts";
import { useAuth, useClient } from "@/lib/auth";
import { dbErrorMessage, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

/** Dados da cliente (todos obrigatórios) e sair da conta. */
export default function ClientProfile() {
  const theme = useTheme();
  const router = useRouter();
  const client = useClient();
  const { refresh, signOut } = useAuth();
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(formatPhone(client.phone));
  const [whatsapp, setWhatsapp] = useState(client.whatsapp);
  const [instagram, setInstagram] = useState(client.instagram);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const normalized = normalizePhone(phone);
    if (name.trim().length < 2) return setError("Informe seu nome.");
    if (!normalized) return setError("Telefone inválido. Use DDD + número.");
    if (instagram.trim().length < 2) return setError("Informe seu Instagram.");
    setSaving(true);
    const { error: e } = await supabase
      .from("clients")
      .update({ name: name.trim(), phone: normalized, whatsapp, instagram: instagram.trim().replace(/^@?/, "@") })
      .eq("id", client.id);
    setSaving(false);
    if (e) return setError(e.code === "23505" ? "Este telefone já está em outro cadastro." : dbErrorMessage(e));
    await refresh();
    router.back();
  };

  return (
    <Screen keyboard>
      <ScreenHeader
        title="Meus dados"
        left={<HeaderButton icon="close" accessibilityLabel="Cancelar" onPress={() => router.back()} />}
        right={<HeaderButton title={saving ? "Salvando…" : "Salvar"} bold onPress={save} />}
      />
      {error && <Banner>{error}</Banner>}
      <Section>
        <FormRow label="Nome">
          <Input value={name} onChangeText={setName} textContentType="name" />
        </FormRow>
        <FormRow label="Telefone">
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </FormRow>
        <SwitchRow label="Este número é WhatsApp" value={whatsapp} onValueChange={setWhatsapp} />
        <FormRow label="Instagram">
          <Input value={instagram} onChangeText={setInstagram} autoCapitalize="none" autoCorrect={false} />
        </FormRow>
      </Section>
      <Section footer="Para trocar o e-mail de acesso, fale com a Gabi.">
        <Row title="E-mail" detail={client.email ?? ""} />
      </Section>
      <CreatePassword variant="section" title="Senha do painel" message="Use com o seu e-mail para entrar no painel." />
      <Section>
        <Pressable
          onPress={signOut}
          style={({ pressed }) => ({ minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? theme.fill : undefined })}
        >
          <Text color="red">Sair</Text>
        </Pressable>
      </Section>
    </Screen>
  );
}
