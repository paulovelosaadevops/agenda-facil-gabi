import { Modal, StyleSheet, View } from "react-native";
import { Serif, useTheme } from "@/lib/theme";
import { Icon } from "./icon";
import { ModalBackdrop } from "./modal-backdrop";
import { Button, Text } from "./ui";

/**
 * Popup ao abrir o link de agendamento (D8, docs/mudanca-login.md): quem já é cliente entra no painel
 * com e-mail e senha; quem é nova segue para escolher o serviço. Mesmo visual do HowItWorksModal.
 */
export function ReturningClientModal({ visible, onReturning, onFirstTime }: { visible: boolean; onReturning: () => void; onFirstTime: () => void }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFirstTime}>
      <ModalBackdrop>
        <View style={[styles.card, { backgroundColor: theme.bg }]} accessibilityViewIsModal>
          <View style={[styles.halo, { backgroundColor: theme.fill }]}>
            <View style={[styles.iconCircle, { backgroundColor: theme.accentStrong }]}>
              <Icon name="person" size={30} color={theme.onAccent} />
            </View>
          </View>
          <Text style={[styles.title, { color: theme.label }]}>Já é minha cliente?</Text>
          <Text color="label2" style={styles.text}>
            Entre no seu painel com e-mail e senha: seus dados já estão lá e você agenda em poucos toques.
          </Text>
          <View style={styles.actions}>
            <Button title="Sim, entrar no meu painel" onPress={onReturning} />
            <Button title="É minha primeira vez" variant="tinted" onPress={onFirstTime} />
          </View>
        </View>
      </ModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 420, borderRadius: 28, padding: 28, alignItems: "center", borderCurve: "continuous" },
  halo: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center" },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: Serif.medium, fontSize: 28, lineHeight: 34, textAlign: "center", marginTop: 24 },
  text: { textAlign: "center", marginTop: 10, lineHeight: 22, maxWidth: 320 },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 28 },
});
