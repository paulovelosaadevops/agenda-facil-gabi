import { StyleSheet, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./icon";
import { Text } from "./ui";

type Step = { icon: IconName; title: string; text: string };

/** Como funciona o agendamento e como usar o painel (boas-vindas do primeiro acesso e "Como funciona"). */
export function howItWorksSections(maxDays: number): { title: string; steps: Step[] }[] {
  return [
    {
      title: "O agendamento",
      steps: [
        {
          icon: "calendarPlus",
          title: "Escolha serviço e horário",
          text: `Aqui no painel, em "Agendar novo horário", ou pelo link da Gabi. Os horários abrem com até ${maxDays} dias de antecedência.`,
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
          title: "Precisa remarcar ou cancelar?",
          text: "Fale com a Gabi pelo WhatsApp.",
        },
      ],
    },
    {
      title: "O seu painel",
      steps: [
        {
          icon: "person",
          title: "Entre com e-mail e senha",
          text: 'Use o e-mail e a senha que você criou. Esqueceu? Toque em "Primeiro acesso ou esqueci a senha" e receba um código por e-mail. Neste aparelho, você já fica conectada.',
        },
        {
          icon: "clock",
          title: "Seu próximo horário",
          text: "Fica no topo, com atalhos para salvar no calendário e para falar com a Gabi sobre ele.",
        },
        {
          icon: "refresh",
          title: "Hora da manutenção",
          text: 'Quando chegar a data ideal de voltar, aparece um aviso com o botão "Agendar manutenção", com o serviço já escolhido.',
        },
        {
          icon: "pencil",
          title: "Meus dados",
          text: "Atualize nome, Instagram e WhatsApp, e troque a sua senha. Telefone e e-mail, só com a Gabi.",
        },
      ],
    },
  ];
}

export function HowItWorks({ maxDays }: { maxDays: number }) {
  const theme = useTheme();
  let n = 0;
  return (
    <View style={{ gap: 20 }}>
      {howItWorksSections(maxDays).map((section) => (
        <View key={section.title} style={{ gap: 14 }}>
          <Text variant="overline" color="label2">
            {section.title.toUpperCase()}
          </Text>
          {section.steps.map((s) => (
            <View key={s.title} style={styles.step}>
              <View style={[styles.icon, { backgroundColor: theme.fill }]}>
                <Icon name={s.icon} size={18} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="headline">
                  {++n}. {s.title}
                </Text>
                <Text variant="subhead" color="label2" style={{ marginTop: 2 }}>
                  {s.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
