import { Redirect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "@/components/logo";
import { SetPassword } from "@/components/set-password";
import { Banner, Button, FormRow, Input, Section, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { callFunction, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

// "forgot": e-mail para o código; "code": digitar o código; "new-password": definir a senha antes de entrar.
type Mode = "password" | "forgot" | "code" | "new-password";

/**
 * Login da cliente: e-mail + senha (D8, docs/mudanca-login.md). "Primeiro acesso ou esqueci a senha" envia um
 * código ao e-mail e, em seguida, pede a senha nova. Não cria conta para quem nunca agendou: o servidor só envia
 * o código se já existir ficha com o e-mail (inclusive cadastrada pela Nail, que ganha a conta no primeiro acesso).
 */
export default function ClientSignIn() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  // Veio do "Já é minha cliente?" do link com um serviço escolhido: depois de entrar, agenda esse serviço.
  const { servico } = useLocalSearchParams<{ servico?: string }>();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Contagem para "Reenviar código".
  useEffect(() => {
    if (mode !== "code") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const target: Href = servico ? { pathname: "/cliente/agendar", params: { servico } } : "/cliente";
  const address = email.trim().toLowerCase();
  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
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
    if (e) setError("E-mail ou senha incorretos. Primeira vez aqui ou esqueceu a senha? Use o link abaixo.");
    // Com a sessão, o redirecionamento acima leva ao painel.
  };

  const sendCode = async () => {
    setError(undefined);
    setNotFound(false);
    if (!validEmail()) return;
    setBusy(true);
    try {
      const res = await callFunction<{ needsProfile: boolean }>("public-booking", { action: "request-code", email: address, forgot: true });
      if (res.needsProfile) return setNotFound(true);
      setCode("");
      setResendAt(Date.now() + 60_000);
      setNow(Date.now());
      setMode("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o código. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(undefined);
    if (!/^\d{6}$/.test(code)) return setError("Digite os 6 números do código.");
    setBusy(true);
    const { error: e } = await supabase.auth.verifyOtp({ email: address, token: code, type: "email" });
    setBusy(false);
    if (e) return setError("Código inválido ou expirado. Peça outro código.");
    setMode("new-password");
  };

  const emailField = (
    <FormRow label="E-mail">
      <Input
        value={email}
        onChangeText={setEmail}
        placeholder="voce@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        onSubmitEditing={() => void (mode === "password" ? signIn() : sendCode())}
      />
    </FormRow>
  );

  const titles: Record<Mode, [string, string]> = {
    password: ["Seu painel", "Acompanhe seus horários e manutenções e faça novos agendamentos. Entre com o seu e-mail e a sua senha."],
    forgot: ["Primeiro acesso", "Informe o e-mail que você usou para agendar. Enviamos um código de 6 números e você cria uma senha nova."],
    code: ["Digite o código", `Enviamos um código de 6 números para ${address}.`],
    "new-password": ["Crie sua senha", "É com ela e o seu e-mail que você entra no seu painel."],
  };

  // Entrou pelo código: fica aqui até criar a senha nova.
  if (role === "client" && mode !== "code" && mode !== "new-password") return <Redirect href={target} />;
  if (role === "owner") return <Redirect href="/inicio" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Logo width={210} />
        </View>
        <Text variant="title1">{titles[mode][0]}</Text>
        <Text color="label2" style={{ marginTop: 4, marginBottom: 24 }}>
          {titles[mode][1]}
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
            <Pressable hitSlop={8} onPress={() => (setError(undefined), setMode("forgot"))} style={styles.link}>
              <Text variant="subhead" color="accent">
                Primeiro acesso ou esqueci a senha
              </Text>
            </Pressable>
          </>
        )}

        {mode === "forgot" && (
          <>
            <Section>{emailField}</Section>
            {error && <Banner>{error}</Banner>}
            {notFound && (
              <Banner tone="info">Não encontramos cadastro com esse e-mail. Confira o endereço ou faça seu primeiro agendamento pelo link abaixo.</Banner>
            )}
            <Button title="Enviar código" onPress={sendCode} loading={busy} disabled={!address} />
            <Pressable hitSlop={8} onPress={() => (setError(undefined), setNotFound(false), setMode("password"))} style={styles.link}>
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
            <Button title="Continuar" onPress={verify} loading={busy} disabled={code.length < 6} />
            <View style={styles.codeLinks}>
              <Pressable hitSlop={8} onPress={() => (setError(undefined), setMode("forgot"))}>
                <Text variant="subhead" color="accent">
                  Trocar e-mail
                </Text>
              </Pressable>
              <Pressable hitSlop={8} disabled={waitSeconds > 0 || busy} onPress={sendCode}>
                <Text variant="subhead" color={waitSeconds > 0 ? "label3" : "accent"}>
                  {waitSeconds > 0 ? `Reenviar em ${waitSeconds}s` : "Reenviar código"}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {mode === "new-password" && <SetPassword buttonTitle="Salvar e entrar" onSaved={() => router.replace(target)} />}

        {(mode === "password" || mode === "forgot") && (
          <Pressable hitSlop={8} onPress={() => router.replace("/agendar")} style={{ marginTop: 32, alignSelf: "center" }}>
            <Text variant="subhead" color="label2">
              Ainda não agendou? <Text variant="subhead" color="accent" style={{ fontWeight: "600" }}>Agendar horário</Text>
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, width: "100%", maxWidth: 520, alignSelf: "center" },
  link: { marginTop: 16, alignSelf: "center" },
  codeLinks: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingHorizontal: 4 },
  codeBox: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16, borderCurve: "continuous" },
  codeInput: { fontSize: 32, letterSpacing: 12, textAlign: "center", fontWeight: "600", paddingVertical: 10, fontVariant: ["tabular-nums"] },
});
