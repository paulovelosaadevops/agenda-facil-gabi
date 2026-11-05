import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Serif, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./icon";
import { ModalBackdrop } from "./modal-backdrop";
import { Button, Text } from "./ui";

type Step = { section?: string; icon: IconName; title: string; text: string };

/** Como funciona o agendamento e como usar o painel, um passo por tela. */
export function howItWorksSteps(maxDays: number): Step[] {
  const booking = "O agendamento";
  const panel = "O seu painel";
  return [
    {
      section: booking,
      icon: "calendarPlus",
      title: "Escolha serviço e horário",
      text: `Aqui no painel, em "Agendar", ou pelo link da Gabi. Os horários abrem com até ${maxDays} dias de antecedência. "Repetir" já traz o seu último serviço.`,
    },
    {
      section: booking,
      icon: "check",
      title: "Confirmação na véspera",
      text: "Seu horário fica reservado. Um dia antes, a Gabi te chama no WhatsApp para confirmar.",
    },
    {
      section: booking,
      icon: "bell",
      title: "Lembretes e manutenção",
      text: "Você recebe um lembrete por e-mail antes do atendimento e um aviso quando chegar a hora da manutenção.",
    },
    {
      section: booking,
      icon: "phone",
      title: "Precisa remarcar ou cancelar?",
      text: "É só falar com a Gabi pelo WhatsApp.",
    },
    {
      section: panel,
      icon: "person",
      title: "Entre com e-mail e senha",
      text: 'Esqueceu a senha? Toque em "Primeiro acesso ou esqueci a senha" e receba um código por e-mail. Neste aparelho, você já fica conectada.',
    },
    {
      section: panel,
      icon: "clock",
      title: "Seu próximo horário",
      text: "Fica no topo do painel, com a contagem regressiva, se já está confirmado e atalhos para o calendário, remarcar e como chegar.",
    },
    {
      section: panel,
      icon: "refresh",
      title: "Sua manutenção",
      text: 'Uma barra mostra os dias até a data ideal de voltar. Perto dela, aparece o botão "Agendar manutenção", com o serviço já escolhido.',
    },
    {
      section: panel,
      icon: "pencil",
      title: "Meus dados",
      text: "Atualize nome, Instagram e WhatsApp, e troque a sua senha. Telefone e e-mail, só com a Gabi.",
    },
  ];
}

/**
 * Popup "Como funciona": um passo por vez, com progresso, Voltar/Próximo e Pular.
 * Com `welcomeName`, abre com a tela de boas-vindas (primeiro acesso da cliente).
 */
export function HowItWorksModal({
  visible,
  maxDays,
  welcomeName,
  onClose,
}: {
  visible: boolean;
  maxDays: number;
  welcomeName?: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const steps: Step[] = [
    ...(welcomeName
      ? [
          {
            icon: "sparkles" as IconName,
            title: `Boas-vindas, ${welcomeName}!`,
            text: "Este é o seu painel com a Gabi Marqui. Em poucos passos, veja como agendar e acompanhar seus horários.",
          },
        ]
      : []),
    ...howItWorksSteps(maxDays),
  ];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;

  const close = () => {
    onClose();
    setIndex(0);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <ModalBackdrop>
        <View style={[styles.card, { backgroundColor: theme.bg }]} accessibilityViewIsModal>
          <View style={styles.top}>
            <Text variant="footnote" color="label3">
              {index + 1} de {steps.length}
            </Text>
            {!last && (
              <Pressable hitSlop={10} onPress={close} accessibilityRole="button">
                <Text variant="subhead" color="label2">
                  Pular
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.body}>
            <View style={[styles.halo, { backgroundColor: theme.fill }]}>
              <View style={[styles.iconCircle, { backgroundColor: theme.accentStrong }]}>
                <Icon name={step.icon} size={30} color={theme.onAccent} />
              </View>
            </View>
            {step.section && (
              <Text variant="overline" style={{ color: theme.champagne, marginTop: 24 }}>
                {step.section.toUpperCase()}
              </Text>
            )}
            <Text style={[styles.title, { color: theme.label, marginTop: step.section ? 6 : 24 }]}>{step.title}</Text>
            <Text color="label2" style={styles.text}>
              {step.text}
            </Text>
          </View>

          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View
                key={s.title}
                style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.separator, width: i === index ? 18 : 6 }]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            {index > 0 && <Button title="Voltar" variant="tinted" onPress={() => setIndex(index - 1)} style={{ flex: 1 }} />}
            <Button title={last ? "Começar a usar" : "Próximo"} onPress={() => (last ? close() : setIndex(index + 1))} style={{ flex: 1 }} />
          </View>
        </View>
      </ModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 420, borderRadius: 28, padding: 24, borderCurve: "continuous" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 22 },
  body: { alignItems: "center", paddingTop: 20, paddingBottom: 8, minHeight: 300 },
  halo: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center" },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: Serif.medium, fontSize: 28, lineHeight: 34, textAlign: "center" },
  text: { textAlign: "center", marginTop: 10, lineHeight: 22, maxWidth: 320 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: 20 },
  dot: { height: 6, borderRadius: 3 },
  actions: { flexDirection: "row", gap: 10 },
});
