import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookingFlow } from "@/components/booking-flow";
import { Logo } from "@/components/logo";
import { Banner, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { buildDays, useStudioInfo } from "@/lib/studio";
import { useTheme } from "@/lib/theme";

/**
 * Link público que a Gabi compartilha (WhatsApp, Instagram): agendamento passo a passo, sem senha.
 * No fim a cliente informa os dados obrigatórios e confirma com o código enviado ao e-mail; depois segue para o painel dela.
 */
export default function PublicBooking() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { servico } = useLocalSearchParams<{ servico?: string }>();
  const router = useRouter();
  const { data, loading, error } = useStudioInfo();
  // Durante a confirmação do código há uma sessão temporária: o fluxo continua aqui até a tela final.
  const [confirming, setConfirming] = useState(false);

  if (!confirming && role === "client") return <Redirect href={servico ? { pathname: "/cliente/agendar", params: { servico } } : "/cliente/agendar"} />;
  if (!confirming && role === "owner") return <Redirect href="/inicio" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.brand}>
          <Logo width={190} />
        </View>

        {error && <Banner>{error}</Banner>}
        {loading || !data ? (
          !error && <Loading />
        ) : data.services.length ? (
          <BookingFlow
            guest
            businessName={data.business.name}
            address={data.business.address}
            studioPhone={data.business.phone}
            services={data.services}
            days={buildDays(data.business.timezone, data.business.max_advance_days)}
            timeZone={data.business.timezone}
            initialServiceId={servico}
            onVerifyStart={() => setConfirming(true)}
            onDone={() => router.replace("/cliente")}
          />
        ) : (
          <Banner tone="info">A agenda online ainda não está aberta. Fale com a Gabi pelo WhatsApp.</Banner>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, width: "100%", maxWidth: 520, alignSelf: "center" },
  brand: { alignItems: "center", marginBottom: 28 },
});
