import { Stack } from "expo-router";
import { modalOptions, useStackOptions } from "@/lib/stack-options";

export const unstable_settings = { anchor: "index" };

export default function ClientesStack() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: "Clientes" }} />
      <Stack.Screen name="[id]" options={{ title: "" }} />
      <Stack.Screen name="form" options={{ ...modalOptions, title: "Cliente" }} />
    </Stack>
  );
}
