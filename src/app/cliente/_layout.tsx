import { Stack } from "expo-router";
import { modalOptions, useStackOptions } from "@/lib/stack-options";

export const unstable_settings = { anchor: "index" };

/** Área da cliente: seus horários, agendar e perfil. */
export default function ClientStack() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: "Meus horários" }} />
      <Stack.Screen name="agendar" options={{ title: "Agendar" }} />
      <Stack.Screen name="perfil" options={{ ...modalOptions, title: "Meus dados" }} />
    </Stack>
  );
}
