import { Stack } from "expo-router";
import { useStackOptions } from "@/lib/stack-options";

export default function InicioStack() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: "Início" }} />
      <Stack.Screen name="notificacoes" options={{ title: "Notificações" }} />
    </Stack>
  );
}
