import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Banner, Button, FormRow, Input, Section } from "./ui";

/** A cliente já definiu a senha? (marcado na conta ao salvar; D8 em docs/mudanca-login.md). */
export function useHasPassword() {
  const { session } = useAuth();
  return Boolean(session?.user.user_metadata?.has_password);
}

/**
 * Definir ou trocar a senha da cliente (mínimo 8 caracteres, digitada duas vezes).
 * Usado no fim do primeiro agendamento, no "esqueci a senha" e no primeiro acesso ao painel.
 */
export function SetPassword({ buttonTitle = "Salvar senha", onSaved }: { buttonTitle?: string; onSaved?: () => void }) {
  const { refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(undefined);
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password, data: { has_password: true } });
    setBusy(false);
    if (e) return setError(/different from the old/i.test(e.message) ? "Use uma senha diferente da anterior." : "Não foi possível salvar a senha. Tente de novo.");
    await refresh();
    onSaved?.();
  };

  return (
    <>
      <Section footer="Mínimo de 8 caracteres. Você vai usar o seu e-mail e esta senha para entrar no painel.">
        <FormRow label="Senha">
          <Input value={password} onChangeText={setPassword} placeholder="Nova senha" secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        </FormRow>
        <FormRow label="Repetir">
          <Input
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Digite de novo"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={save}
          />
        </FormRow>
      </Section>
      {error && <Banner>{error}</Banner>}
      <Button title={buttonTitle} onPress={save} loading={busy} disabled={!password || !confirm} />
    </>
  );
}
