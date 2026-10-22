import { Redirect } from "expo-router";
import { View } from "react-native";
import { Banner, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

/** Porta de entrada: cada papel vai para a sua área. */
export default function Index() {
  const theme = useTheme();
  const { session, role, studioExists, signOut } = useAuth();
  // Sem login: entrada da Gabi. As clientes usam o link público /agendar.
  if (!session) return <Redirect href="/login" />;
  if (role === "owner") return <Redirect href="/inicio" />;
  if (role === "client") return <Redirect href="/cliente" />;
  if (!studioExists) return <Redirect href="/onboarding" />;

  // Conta sem ficha de cliente (ex.: cadastro interrompido).
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.bg }}>
      <Banner>Não encontramos o seu cadastro de cliente. Entre de novo ou crie a conta pelo link do estúdio.</Banner>
      <Button title="Sair" variant="tinted" onPress={signOut} />
    </View>
  );
}
