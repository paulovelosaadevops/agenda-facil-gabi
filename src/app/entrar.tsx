import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "@/components/logo";
import { Banner, Button, FormRow, Input, Section, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

type Mode = "password" | "code-email" | "code";

/**
 * Painel da cliente: entra com e-mail e senha. "Esqueci minha senha / primeiro acesso" entra com um código
 * enviado ao e-mail e, no painel, pede para criar uma senha nova. Só entra quem já agendou (não cria conta).
 */
export default function ClientSignIn() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  // Entrou pelo código: vai ao painel pedindo uma senha nova.
  if (role === "client") return <Redirect href={mode === "code" ? { pathname: "/cliente", params: { senha: "1" } } : "/cliente"} />;
  if (role === "owner") return <Redirect href="/inicio" />;

  const address = email.trim().toLowerCase();
  const validEmail = () => {
    if (/^\S+@\S+\.\S+$/.test(address)) return true;
    setError("Informe um e-mail válido.");
    return false;
  };

  const signIn = async () => {
    setError(undefined);
    if (!validEmail()) return;
    if (!password) return setError("Informe a sua senha.");
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: address, password });
    setBusy(false);
    if (e) return setError("E-mail ou senha incorretos. Se ainda não criou uma senha, use “Primeiro acesso ou esqueci a senha”.");
  };

  const sendCode = async () => {
    setError(undefined);
    setNotFound(false);
    if (!validEmail()) return;
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
    setBusy(false);
    if (e) {
      if (/signups not allowed|not found|user/i.test(e.message)) return setNotFound(true);
      if (/rate|seconds|security purposes/i.test(e.message)) return setError("Aguarde alguns segundos para pedir outro código.");
      return setError("Não foi possível enviar o código. Tente de novo.");
    }
    setMode("code");
  };

  const verify = async () => {
    setError(undefined);
    if (!/^\d{6}$/.test(code)) return setError("Digite os 6 números do código.");
    setBusy(true);
    const { error: e } = await supabase.auth.verifyOtp({ email: address, token: code, type: "email" });
    setBusy(false);
    if (e) setError("Código inválido ou expirado. Peça outro código.");
    // Com a sessão, o redirecionamento acima leva ao painel.
  };

  const emailField = (
    <FormRow label="E-mail">
      <Input value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    </FormRow>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Logo width={210} />
        </View>
        <Text variant="title1">{mode === "password" ? "Seu painel" : "Acesso por código"}</Text>
        <Text color="label2" style={{ marginTop: 4, marginBottom: 24 }}>
          {mode === "password"
            ? "Acompanhe seus próximos horários e manutenções. Entre com o e-mail que você usou para agendar e a sua senha."
            : mode === "code-email"
              ? "Enviamos um código para o seu e-mail. Depois de entrar, você cria uma senha nova."
              : `Enviamos um código de 6 números para ${address}.`}
        </Text>

        {mode === "password" && (
          <>
            <Section>
              {emailField}
              <FormRow label="Senha">
                <Input value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry autoComplete="current-password" onSubmitEditing={signIn} />
              </FormRow>
            </Section>
            {error && <Banner>{error}</Banner>}
            <Button title="Entrar" onPress={signIn} loading={busy} />
            <Pressable hitSlop={8} onPress={() => (setError(undefined), setMode("code-email"))} style={styles.link}>
              <Text variant="subhead" color="accent">
                Primeiro acesso ou esqueci a senha
              </Text>
            </Pressable>
          </>
        )}

        {mode === "code-email" && (
          <>
            <Section>{emailField}</Section>
            {error && <Banner>{error}</Banner>}
            {notFound && (
              <Banner tone="info">Não encontramos agendamentos com esse e-mail. Confira o endereço ou faça seu primeiro agendamento.</Banner>
            )}
            <Button title="Enviar código" onPress={sendCode} loading={busy} />
            <Pressable hitSlop={8} onPress={() => (setError(undefined), setMode("password"))} style={styles.link}>
              <Text variant="subhead" color="accent">
                Entrar com senha
              </Text>
            </Pressable>
          </>
        )}

        {mode === "code" && (
          <>
            <View style={[styles.codeBox, { backgroundColor: theme.surface }]}>
              <Input
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                style={[styles.codeInput, { color: theme.label }]}
              />
            </View>
            {error && <Banner>{error}</Banner>}
            <Button title="Entrar" onPress={verify} loading={busy} disabled={code.length < 6} />
            <Pressable hitSlop={8} onPress={() => (setCode(""), setMode("code-email"))} style={styles.link}>
              <Text variant="subhead" color="accent">
                Trocar e-mail
              </Text>
            </Pressable>
          </>
        )}

        <Pressable hitSlop={8} onPress={() => router.replace("/agendar")} style={{ marginTop: 32, alignSelf: "center" }}>
          <Text variant="subhead" color="label2">
            Ainda não agendou? <Text variant="subhead" color="accent" style={{ fontWeight: "600" }}>Agendar horário</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, width: "100%", maxWidth: 520, alignSelf: "center" },
  link: { marginTop: 16, alignSelf: "center" },
  codeBox: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16, borderCurve: "continuous" },
  codeInput: { fontSize: 32, letterSpacing: 12, textAlign: "center", fontWeight: "600", paddingVertical: 10, fontVariant: ["tabular-nums"] },
});
