import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { fontFamily, Type, useTheme } from "@/lib/theme";
import { Logo } from "./logo";
import { Banner, Button, hairline, Text } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const theme = useTheme();
  const isLogin = mode === "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(undefined);
    setMessage(undefined);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Informe um e-mail válido.");
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    setLoading(true);
    const credentials = { email: email.trim(), password };
    const { data, error: authError } = isLogin
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);
    setLoading(false);
    if (authError) return setError(isLogin ? "E-mail ou senha incorretos." : authError.message);
    if (!isLogin && !data.session) setMessage("Enviamos um link de confirmação para o seu e-mail.");
    // Com sessão, o layout raiz redireciona sozinho (rotas protegidas).
  };

  const field = [Type.body, styles.field, { color: theme.label, fontFamily }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Logo width={250} />
            {!isLogin && (
              <Text variant="title2" style={{ marginTop: 24, textAlign: "center" }}>
                Configurar o estúdio
              </Text>
            )}
            {!isLogin && (
              <Text color="label2" style={{ marginTop: 10, textAlign: "center" }}>
                Primeiro acesso: esta será a conta da profissional.
              </Text>
            )}
          </View>

          <View style={[styles.group, { backgroundColor: theme.surface }]}>
            <TextInput
              style={field}
              placeholder="E-mail"
              placeholderTextColor={theme.label3}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
            />
            <View style={{ height: hairline, backgroundColor: theme.separator, marginLeft: 16 }} />
            <TextInput
              style={field}
              placeholder={isLogin ? "Senha" : "Senha (mínimo 8 caracteres)"}
              placeholderTextColor={theme.label3}
              secureTextEntry
              autoComplete={isLogin ? "current-password" : "new-password"}
              textContentType={isLogin ? "password" : "newPassword"}
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>

          {error && <Banner>{error}</Banner>}
          {message && <Banner tone="success">{message}</Banner>}
          <Button title={isLogin ? "Entrar" : "Continuar"} onPress={submit} loading={loading} />

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
            <Text variant="subhead" color="label2">
              {isLogin ? "Ainda não tem conta?" : "Já tem conta?"}
            </Text>
            <Link href={isLogin ? "/cadastro" : "/login"} replace>
              <Text variant="subhead" color="accent">
                {isLogin ? "Criar conta" : "Entrar"}
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 20 },
  inner: { width: "100%", maxWidth: 400, alignSelf: "center" },
  group: { borderRadius: 12, overflow: "hidden", marginBottom: 16, borderCurve: "continuous" },
  field: { height: 50, paddingHorizontal: 16, outlineWidth: 0 },
});
