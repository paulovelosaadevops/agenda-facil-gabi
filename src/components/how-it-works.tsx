import { StyleSheet, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./icon";
import { Text } from "./ui";

/** Passos do agendamento, do jeito que a cliente vive (boas-vindas do primeiro acesso e "Como funciona"). */
export function howItWorksSteps(maxDays: number): { icon: IconName; title: string; text: string }[] {
  return [
    {
      icon: "calendarPlus",
      title: "Escolha serviço e horário",
      text: `Pelo link da Gabi ou aqui no painel, em "Agendar novo horário". Os horários abrem com até ${maxDays} dias de antecedência.`,
    },
    {
      icon: "message",
      title: "Entre só com o seu e-mail",
      text: "Não tem senha: enviamos um código de 6 números para o seu e-mail sempre que você entrar.",
    },
    {
      icon: "check",
      title: "Confirmação na véspera",
      text: "Seu horário fica reservado. Um dia antes, a Gabi te chama no WhatsApp para confirmar.",
    },
    {
      icon: "bell",
      title: "Lembretes e manutenção",
      text: "Você recebe um lembrete por e-mail antes do atendimento e um aviso quando chegar a hora da manutenção.",
    },
    {
      icon: "phone",
      title: "Precisa remarcar?",
      text: "Para remarcar ou cancelar, fale com a Gabi pelo WhatsApp.",
    },
  ];
}

export function HowItWorks({ maxDays }: { maxDays: number }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 16 }}>
      {howItWorksSteps(maxDays).map((s, i) => (
        <View key={s.title} style={styles.step}>
          <View style={[styles.icon, { backgroundColor: theme.fill }]}>
            <Icon name={s.icon} size={18} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline">
              {i + 1}. {s.title}
            </Text>
            <Text variant="subhead" color="label2" style={{ marginTop: 2 }}>
              {s.text}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
