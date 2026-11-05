import { useRouter } from "expo-router";
import { HowItWorks } from "@/components/how-it-works";
import { ScreenHeader } from "@/components/screen-header";
import { HeaderButton, Screen } from "@/components/ui";
import { useStudioInfo } from "@/lib/studio";

/** "Como funciona o agendamento": as mesmas explicações das boas-vindas do primeiro acesso. */
export default function HowItWorksScreen() {
  const router = useRouter();
  const { data: studio } = useStudioInfo();
  return (
    <Screen>
      <ScreenHeader title="Como funciona" left={<HeaderButton icon="close" accessibilityLabel="Fechar" onPress={() => router.back()} />} />
      <HowItWorks maxDays={studio?.business.max_advance_days ?? 14} />
    </Screen>
  );
}
