import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { SetPassword } from "@/components/set-password";
import { Banner, FormRow, HeaderButton, Input, Row, Screen, Section, SwitchRow, Text } from "@/components/ui";
import { formatPhone } from "@shared/format.ts";
import { useAuth, useClient } from "@/lib/auth";
import { dbErrorMessage, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

/**
 * Dados da cliente (todos obrigatórios) e sair da conta.
 * Telefone e e-mail identificam a conta: só a Gabi altera (D5, docs/mudanca-login.md).
 */
export default function ClientProfile() {
  const theme = useTheme();
  const router = useRouter();
  const client = useClient();
  const { refresh, signOut } = useAuth();
  const [name, setName] = useState(client.name);
  const [whatsapp, setWhatsapp] = useState(client.whatsapp);
  const [instagram, setInstagram] = useState(client.instagram);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) return setError("Informe seu nome.");
    if (instagram.trim().length < 2) return setError("Informe seu Instagram.");
    setSaving(true);
    const { error: e } = await supabase
      .from("clients")
      .update({ name: name.trim(), whatsapp, instagram: instagram.trim().replace(/^@?/, "@") })
      .eq("id", client.id);
    setSaving(false);
    if (e) return setError(dbErrorMessage(e));
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
        <SwitchRow label="Este número é WhatsApp" value={whatsapp} onValueChange={setWhatsapp} />
        <FormRow label="Instagram">
          <Input value={instagram} onChangeText={setInstagram} autoCapitalize="none" autoCorrect={false} />
        </FormRow>
      </Section>
      <Section footer="Para trocar o telefone ou o e-mail, fale com a Gabi.">
        <Row title="Telefone" detail={formatPhone(client.phone)} />
        <Row title="E-mail" detail={client.email ?? ""} />
      </Section>
      <Text variant="overline" color="label2" style={{ marginHorizontal: 16, marginBottom: 6 }}>
        TROCAR SENHA
      </Text>
      <View style={{ marginBottom: 28 }}>
        <SetPassword buttonTitle="Salvar nova senha" onSaved={() => setPasswordSaved(true)} />
        {passwordSaved && <Banner tone="success">Senha alterada.</Banner>}
      </View>
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
