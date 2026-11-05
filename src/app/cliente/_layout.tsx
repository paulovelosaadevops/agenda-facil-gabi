import { Stack } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "@/components/logo";
import { SetPassword, useHasPassword } from "@/components/set-password";
import { Text } from "@/components/ui";
import { modalOptions, useStackOptions } from "@/lib/stack-options";
import { useTheme } from "@/lib/theme";

export const unstable_settings = { anchor: "index" };

/** Sem senha ainda (ex.: fechou o app antes de criar): o painel só abre depois de criar a senha (D8). */
function FirstPassword() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40, width: "100%", maxWidth: 520, alignSelf: "center" }}
      >
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Logo width={210} />
        </View>
        <Text variant="title1">Crie sua senha</Text>
        <Text color="label2" style={{ marginTop: 4, marginBottom: 20 }}>
          Antes de abrir o seu painel: é com ela e o seu e-mail que você entra das próximas vezes.
        </Text>
        <SetPassword buttonTitle="Salvar e abrir o painel" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Área da cliente: seus horários, agendar e perfil. */
export default function ClientStack() {
  const stackOptions = useStackOptions();
  if (!useHasPassword()) return <FirstPassword />;
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: "Meus horários" }} />
      <Stack.Screen name="agendar" options={{ title: "Agendar" }} />
      <Stack.Screen name="perfil" options={{ ...modalOptions, title: "Meus dados" }} />
      <Stack.Screen name="como-funciona" options={{ ...modalOptions, title: "Como funciona" }} />
    </Stack>
  );
}
