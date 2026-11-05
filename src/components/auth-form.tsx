import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { fontFamily, Type, useTheme } from "@/lib/theme";
import { Logo } from "./logo";
import { Banner, Button, hairline, Text } from "./ui";

/**
 * Login da Nail (e-mail + senha). Não existe cadastro pelo app: a conta dela é criada por script
 * (docs/mudanca-login.md). Clientes entram pelo /entrar, com código por e-mail.
 */
export function AuthForm() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(undefined);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Informe um e-mail válido.");
    if (!password) return setError("Informe a sua senha.");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authError) return setError("E-mail ou senha incorretos.");
    // Com sessão, o layout raiz redireciona sozinho (rotas protegidas).
  };

  const field = [Type.body, styles.field, { color: theme.label, fontFamily }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Logo width={250} />
            <Text color="label2" style={{ marginTop: 16, textAlign: "center" }}>
              Acesso do estúdio
            </Text>
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
              placeholder="Senha"
              placeholderTextColor={theme.label3}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>

          {error && <Banner>{error}</Banner>}
          <Button title="Entrar" onPress={submit} loading={loading} />

          {/* Sem "Criar conta": clientes entram no próprio painel com código por e-mail. */}
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
            <Text variant="subhead" color="label2">
              É cliente?
            </Text>
            <Link href="/entrar" replace>
              <Text variant="subhead" color="accent">
                Acessar meu painel
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
