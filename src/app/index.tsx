import { Redirect } from "expo-router";
import { View } from "react-native";
import { Banner, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

/** Porta de entrada: cada papel vai para a sua área. */
export default function Index() {
  const theme = useTheme();
  const { session, role, signOut } = useAuth();
  // Sem login: entrada da Gabi. As clientes usam o link público /agendar ou o /entrar.
  if (!session) return <Redirect href="/login" />;
  if (role === "owner") return <Redirect href="/inicio" />;
  if (role === "client") return <Redirect href="/cliente" />;

  // Conta sem estúdio e sem ficha de cliente: não há o que mostrar (não existe cadastro pelo app).
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.bg }}>
      <Banner>Esta conta não tem acesso. Clientes entram pelo link de agendamento ou por “Acessar meu painel”.</Banner>
      <Button title="Sair" variant="tinted" onPress={signOut} />
    </View>
  );
}
