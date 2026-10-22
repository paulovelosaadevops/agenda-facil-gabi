import { Stack } from "expo-router";
import { modalOptions, useStackOptions } from "@/lib/stack-options";

export const unstable_settings = { anchor: "index" };

export default function AjustesStack() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: "Ajustes" }} />
      <Stack.Screen name="estudio" options={{ title: "Estúdio" }} />
      <Stack.Screen name="agendamento" options={{ title: "Agendamento" }} />
      <Stack.Screen name="expediente" options={{ title: "Expediente" }} />
      <Stack.Screen name="folgas" options={{ title: "Bloqueios" }} />
      <Stack.Screen name="nova-folga" options={{ ...modalOptions, title: "Bloquear" }} />
      <Stack.Screen name="servicos" options={{ title: "Serviços" }} />
      <Stack.Screen name="servico" options={{ ...modalOptions, title: "Serviço" }} />
    </Stack>
  );
}
