import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookingFlow } from "@/components/booking-flow";
import { Logo } from "@/components/logo";
import { ReturningClientModal } from "@/components/returning-client-modal";
import { Banner, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { buildDays, useStudioInfo } from "@/lib/studio";
import { useTheme } from "@/lib/theme";

/**
 * Link público que a Gabi compartilha (WhatsApp, Instagram): agendamento passo a passo.
 * Primeira vez: dados obrigatórios, código por e-mail e criação da senha; depois o painel. Quem já é cliente entra
 * pelo "Já é minha cliente?" (e-mail + senha) ou com a senha no próprio fluxo (D8, docs/mudanca-login.md).
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
  const [askReturning, setAskReturning] = useState(true);

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

        {/* D8: ao abrir o link, quem já é cliente entra no painel (e-mail + senha) e agenda por lá. */}
        <ReturningClientModal
          visible={askReturning}
          onReturning={() => {
            setAskReturning(false);
            router.push(servico ? { pathname: "/entrar", params: { servico } } : "/entrar");
          }}
          onFirstTime={() => setAskReturning(false)}
        />

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
