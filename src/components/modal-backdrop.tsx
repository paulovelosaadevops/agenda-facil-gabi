import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";

/**
 * Fundo dos popups: desfoca a tela de trás para o foco ficar só no card.
 * Web e iOS: desfoque de verdade (expo-blur). Android: só escurece — lá o desfoque exige envolver o conteúdo
 * de fundo num BlurTargetView, que fica fora do Modal.
 */
export function ModalBackdrop({ children }: { children: ReactNode }) {
  const blur = Platform.OS !== "android";
  return (
    <View style={styles.root}>
      {blur && <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: blur ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.55)" }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
});
