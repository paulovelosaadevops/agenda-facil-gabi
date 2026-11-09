import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { Platform } from "react-native";
import { Serif, useTheme } from "./theme";

type StackOptions = NonNullable<ComponentProps<typeof Stack>["screenOptions"]>;

/** Opções padrão das pilhas do painel: cor de destaque, fundo agrupado, título grande na raiz. */
export function useStackOptions(): StackOptions {
  const theme = useTheme();
  return {
    headerTintColor: theme.accent,
    // Títulos da barra na serifada (no iOS 26 o sistema só usa fonte própria se informada aqui).
    headerTitleStyle: { color: theme.label, fontFamily: Serif.semibold, fontSize: 21 },
    headerLargeTitleStyle: { color: theme.label, fontFamily: Serif.semibold, fontSize: 38 },
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: Platform.OS === "web",
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: theme.bg },
    headerStyle: Platform.OS === "web" ? { backgroundColor: theme.bg } : undefined,
    // Título centralizado como no iOS (no Android nativo fica o padrão Material).
    headerTitleAlign: Platform.OS === "web" ? "center" : undefined,
  };
}

/**
 * Formulários flutuantes: cartão modal no iOS e Android; no site, janela centralizada no computador e painel
 * que sobe de baixo no celular (modal web do Expo Router, ligado por EXPO_UNSTABLE_WEB_MODAL nos .env).
 */
export const modalOptions = {
  presentation: "modal",
  headerLargeTitleEnabled: false,
  sheetCornerRadius: 24,
  webModalStyle: {
    width: 560,
    minWidth: 320,
    border: "none",
    overlayBackground: "rgba(0, 0, 0, 0.45)",
    shadow: "drop-shadow(0 18px 48px rgba(0, 0, 0, 0.28))",
  },
} as const;
