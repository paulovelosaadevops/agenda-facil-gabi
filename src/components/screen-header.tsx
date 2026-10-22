import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { Text } from "./ui";

const WEB_INSET = Platform.OS === "web" ? 16 : 0;

/**
 * Configura o cabeçalho da tela.
 * - iPhone/Android: barra nativa; com `large`, título grande que encolhe ao rolar (iOS).
 * - Web: título grande desenhado no conteúdo (a web não tem barra nativa).
 * Coloque dentro do <Screen> (ScrollView) da tela.
 */
export function ScreenHeader({
  title,
  large,
  subtitle,
  right,
  left,
}: {
  title: string;
  large?: boolean;
  subtitle?: string;
  right?: ReactNode;
  left?: ReactNode;
}) {
  if (Platform.OS === "web" && large) {
    return (
      <>
        <Stack.Screen options={{ title, headerShown: false }} />
        <View style={{ paddingTop: 24, paddingBottom: 20 }}>
          {/* Botões na linha do título (não na do subtítulo). */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text variant="largeTitle" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </Text>
            {right && <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>{right}</View>}
          </View>
          {subtitle && (
            <Text variant="subhead" color="label2" style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLargeTitleEnabled: Boolean(large),
          // Na web a barra não tem margem própria: sem o padding os botões encostam na borda.
          headerRight: right ? () => <View style={{ flexDirection: "row", gap: 16, paddingRight: WEB_INSET }}>{right}</View> : undefined,
          headerLeft: left ? () => <View style={{ paddingLeft: WEB_INSET }}>{left}</View> : undefined,
        }}
      />
      {large && subtitle && (
        <Text variant="subhead" color="label2" style={{ marginBottom: 16, marginTop: -4 }}>
          {subtitle}
        </Text>
      )}
    </>
  );
}
