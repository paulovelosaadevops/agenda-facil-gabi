import { Stack } from "expo-router";
import { modalOptions, useStackOptions } from "@/lib/stack-options";

export const unstable_settings = { anchor: "index" };

export default function AgendaStack() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: "Agenda" }} />
      <Stack.Screen name="novo" options={{ ...modalOptions, title: "Novo agendamento" }} />
      <Stack.Screen name="[id]" options={{ ...modalOptions, title: "Agendamento" }} />
      <Stack.Screen name="horarios" options={{ title: "Horários livres" }} />
    </Stack>
  );
}
