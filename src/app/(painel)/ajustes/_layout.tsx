import { Stack } from "expo-router";
import { modalOptions, useStackOptions } from "@/lib/stack-options";

export const unstable_settings = { anchor: "index" };

export default function AjustesStack() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: "Ajustes" }} />
      {/* Formulários de ajustes abrem flutuantes, como os de agendamento e cliente. */}
      <Stack.Screen name="estudio" options={{ ...modalOptions, title: "Estúdio" }} />
      <Stack.Screen name="agendamento" options={{ ...modalOptions, title: "Agendamento" }} />
      <Stack.Screen name="expediente" options={{ ...modalOptions, title: "Expediente" }} />
      <Stack.Screen name="folgas" options={{ title: "Bloqueios" }} />
      <Stack.Screen name="nova-folga" options={{ ...modalOptions, title: "Bloquear" }} />
      <Stack.Screen name="servicos" options={{ title: "Serviços" }} />
      <Stack.Screen name="servico" options={{ ...modalOptions, title: "Serviço" }} />
    </Stack>
  );
}
