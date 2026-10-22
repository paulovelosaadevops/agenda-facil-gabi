import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { normalizePhone } from "@shared/format.ts";
import { Brand } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Logo } from "./logo";
import { Banner, Button, FormRow, Input, Section, SwitchRow, Text } from "./ui";

/** Cadastro da cliente: login próprio + dados obrigatórios do estúdio. */
export function ClientSignup() {
  const theme = useTheme();
  const [form, setForm] = useState({ name: "", phone: "", instagram: "", email: "", password: "" });
  const [whatsapp, setWhatsapp] = useState(true);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const submit = async () => {
    setError(undefined);
    const phone = normalizePhone(form.phone);
    const instagram = form.instagram.trim().replace(/^@?/, "@");
    if (form.name.trim().split(/\s+/).length < 2) return setError("Informe nome e sobrenome.");
    if (!phone) return setError("Telefone inválido. Use DDD + número.");
    if (instagram.length < 3) return setError("Informe seu Instagram.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Informe um e-mail válido.");
    if (form.password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      // O banco cria (ou liga) a ficha da cliente a partir destes dados.
      options: { data: { role: "client", name: form.name.trim(), phone, whatsapp, instagram } },
    });
    setLoading(false);
    if (signUpError) {
      if (/already registered|already exists/i.test(signUpError.message)) return setError("Este e-mail já tem conta. Entre com sua senha.");
      if (/database error/i.test(signUpError.message)) return setError("Este telefone ou e-mail já está ligado a outra conta. Fale com a Gabi.");
      return setError(signUpError.message);
    }
    if (!data.session) setMessage("Enviamos um link de confirmação para o seu e-mail. Depois é só entrar.");
    // Com sessão, o layout raiz leva para a área da cliente.
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <Logo width={220} />
            <Text variant="title1" style={{ marginTop: 24 }}>
              Criar conta
            </Text>
            <Text color="label2" style={{ marginTop: 4, textAlign: "center" }}>
              Para agendar com {Brand.fullName}
            </Text>
          </View>

          <Section header="Seus dados">
            <FormRow label="Nome">
              <Input value={form.name} onChangeText={set("name")} placeholder="Nome e sobrenome" textContentType="name" autoComplete="name" />
            </FormRow>
            <FormRow label="Telefone">
              <Input value={form.phone} onChangeText={set("phone")} placeholder="(11) 99999-8888" keyboardType="phone-pad" autoComplete="tel" />
            </FormRow>
            <SwitchRow label="Este número é WhatsApp" value={whatsapp} onValueChange={setWhatsapp} />
            <FormRow label="Instagram">
              <Input value={form.instagram} onChangeText={set("instagram")} placeholder="@seuperfil" autoCapitalize="none" autoCorrect={false} />
            </FormRow>
          </Section>

          <Section header="Acesso" footer="Com sua conta, seus agendamentos ficam guardados e você não precisa preencher os dados de novo.">
            <FormRow label="E-mail">
              <Input value={form.email} onChangeText={set("email")} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            </FormRow>
            <FormRow label="Senha">
              <Input value={form.password} onChangeText={set("password")} placeholder="Mínimo 8 caracteres" secureTextEntry autoComplete="new-password" />
            </FormRow>
          </Section>

          {error && <Banner>{error}</Banner>}
          {message && <Banner tone="success">{message}</Banner>}
          <Button title="Criar conta" onPress={submit} loading={loading} />

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
            <Text variant="subhead" color="label2">
              Já tem conta?
            </Text>
            <Link href="/login" replace>
              <Text variant="subhead" color="accent">
                Entrar
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
