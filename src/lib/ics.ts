import { Linking, Platform } from "react-native";

/**
 * "Adicionar ao calendário": abre o link do .ics gerado pelo servidor (função "calendar").
 * iPhone (Safari/app instalado) mostra "Adicionar ao Calendário"; Android abre o app de calendário.
 */
export function openCalendar(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Mesma aba: no app instalado (PWA) o iPhone abre o .ics direto no Calendário.
    window.location.href = url;
    return;
  }
  void Linking.openURL(url);
}
