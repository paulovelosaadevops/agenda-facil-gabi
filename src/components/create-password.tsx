import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Banner, Button, FormRow, Input, Section, Text } from "./ui";

/** A cliente já criou a senha do painel? (marcado nos dados da conta ao salvar). */
export function useHasPassword() {
  const { session } = useAuth();
  return Boolean(session?.user.user_metadata?.has_password);
}

/**
 * Senha do painel da cliente (entrar depois com e-mail e senha).
 * `variant="card"`: cartão de destaque (após agendar / no painel); `"section"`: em Meus dados.
 */
export function CreatePassword({
  title = "Crie sua senha",
  message = "Assim você entra no seu painel com o seu e-mail e esta senha sempre que quiser.",
  variant = "card",
  onSaved,
}: {
  title?: string;
  message?: string;
  variant?: "card" | "section";
  onSaved?: () => void;
}) {
  const theme = useTheme();
  const { session, refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(undefined);
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password, data: { has_password: true } });
    setBusy(false);
    if (e) {
      if (/same|different from the old/i.test(e.message)) return setError("Escolha uma senha diferente da atual.");
      return setError("Não foi possível salvar a senha. Tente de novo.");
    }
    setSaved(true);
    setPassword("");
    setConfirm("");
    await refresh();
    onSaved?.();
  };

  if (saved && variant === "card") {
    return (
      <Banner tone="success">
        Senha criada! Para voltar ao painel, entre com {session?.user.email ?? "o seu e-mail"} e a sua senha.
      </Banner>
    );
  }

  const fields = (
    <>
      <FormRow label="Senha">
        <Input value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" secureTextEntry autoComplete="new-password" />
      </FormRow>
      <FormRow label="Confirmar">
        <Input value={confirm} onChangeText={setConfirm} placeholder="Repita a senha" secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
      </FormRow>
    </>
  );

  if (variant === "section") {
    return (
      <>
        <Section header={title} footer={saved ? "Senha alterada." : message}>
          {fields}
        </Section>
        {error && <Banner>{error}</Banner>}
        <Button title="Salvar senha" variant="tinted" onPress={save} loading={busy} style={{ marginTop: -12, marginBottom: 28 }} />
      </>
    );
  }

  return (
    <View style={{ alignSelf: "stretch", borderRadius: 18, padding: 18, marginTop: 18, backgroundColor: theme.accentTint, borderCurve: "continuous" }}>
      <Text variant="headline">{title}</Text>
      <Text variant="subhead" color="label2" style={{ marginTop: 2, marginBottom: 14 }}>
        {message}
      </Text>
      <Section style={{ marginBottom: 12 }}>{fields}</Section>
      {error && <Banner>{error}</Banner>}
      <Button title="Salvar senha" onPress={save} loading={busy} />
    </View>
  );
}
