// Importa só os pesos usados (o índice do pacote embutiria as 10 variações, ~5 MB).
import { CormorantGaramond_500Medium } from "@expo-google-fonts/cormorant-garamond/500Medium";
import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond/600SemiBold";
import { CormorantGaramond_700Bold } from "@expo-google-fonts/cormorant-garamond/700Bold";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { loading, session, role, studioExists } = useAuth();
  // Títulos em Cormorant Garamond (carregada em tempo de execução; funciona no Expo Go e na web).
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
  });
  const ready = !loading && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null; // a tela de abertura continua visível

  const signedIn = Boolean(session);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Link que a Gabi compartilha: sempre acessível; leva ao login/cadastro ou ao agendamento. */}
      <Stack.Screen name="agendar" />
      {/* Painel da cliente: entrada com e-mail e código (sem senha). */}
      <Stack.Screen name="entrar" />

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="cadastro" />
      </Stack.Protected>

      {/* Primeira instalação: quem cria a conta configura o estúdio (a Gabi). */}
      <Stack.Protected guard={signedIn && role === "none" && !studioExists}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={role === "owner"}>
        <Stack.Screen name="(painel)" />
      </Stack.Protected>

      <Stack.Protected guard={role === "client"}>
        <Stack.Screen name="cliente" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: theme.accent,
          background: theme.bg,
          card: theme.bg,
          text: theme.label,
          border: theme.separator,
        },
      }}
    >
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
