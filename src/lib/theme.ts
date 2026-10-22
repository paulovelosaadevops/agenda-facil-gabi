import { Platform, useColorScheme } from "react-native";

/**
 * Identidade "Nude & Champagne": marfim quente, grafite e champagne.
 * Os componentes só usam estes nomes, então o modo escuro é automático.
 */
const light = {
  bg: "#F7F3EE", // marfim
  surface: "#FFFFFF",
  elevated: "#F7F3EE",
  fill: "rgba(43,39,36,0.07)",
  fill2: "rgba(43,39,36,0.04)",
  label: "#2B2724", // grafite
  label2: "rgba(43,39,36,0.58)",
  label3: "rgba(43,39,36,0.3)",
  separator: "rgba(43,39,36,0.1)",
  /** Champagne escurecido: contraste suficiente para texto e ícones sobre o branco. */
  accent: "#8A6A4A",
  /** Champagne puro, para detalhes decorativos (linhas, trilho do switch). */
  champagne: "#A8896B",
  // Logo sobre o fundo da tela (marfim no claro).
  logo: "#8A6A4A",
  accentTint: "rgba(168,137,107,0.14)",
  /** Botões principais e destaques fortes: grafite com texto marfim. */
  accentStrong: "#2B2724",
  onAccent: "#F7F3EE",
  // Status em tons sóbrios
  statusConfirmed: "#5B7083", // ardósia
  statusPending: "#B08440", // ocre
  statusCompleted: "#6E8B6B", // sálvia
  statusNoShow: "#A65A52", // terracota
  red: "#A65A52",
  green: "#5E7A5B",
  orange: "#B08440",
  blue: "#5B7083",
};

const dark: typeof light = {
  bg: "#141210",
  surface: "#1F1C1A",
  elevated: "#1F1C1A",
  fill: "rgba(242,236,228,0.09)",
  fill2: "rgba(242,236,228,0.05)",
  label: "#F2ECE4",
  label2: "rgba(242,236,228,0.6)",
  label3: "rgba(242,236,228,0.3)",
  separator: "rgba(242,236,228,0.12)",
  accent: "#CDB295",
  champagne: "#B89A7B",
  logo: "#D8BD93",
  accentTint: "rgba(205,178,149,0.14)",
  accentStrong: "#E9DFD2",
  onAccent: "#1F1C1A",
  statusConfirmed: "#93A7B8",
  statusPending: "#D3A766",
  statusCompleted: "#9DB599",
  statusNoShow: "#D08C83",
  red: "#D08C83",
  green: "#9DB599",
  orange: "#D3A766",
  blue: "#93A7B8",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

/** Fontes serifadas carregadas no layout raiz (expo-font). */
/** Dourado original da logo da Gabi (para fundos escuros). */
export const LOGO_GOLD = "#D8BD93";

export const Serif = {
  medium: "CormorantGaramond_500Medium",
  semibold: "CormorantGaramond_600SemiBold",
  bold: "CormorantGaramond_700Bold",
};

// Texto corrido na fonte do sistema (SF no iPhone/Mac, Roboto no Android).
export const fontFamily = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

// A Cormorant usa algarismos "antigos" por padrão (o 1 vira I); nos títulos queremos alinhados.
const lining = ["lining-nums"] as ("lining-nums")[];

// Títulos na serifada; com fonte customizada não se usa fontWeight (o peso vem do arquivo).
export const Type = {
  largeTitle: { fontVariant: lining, fontSize: 38, lineHeight: 44, fontFamily: Serif.semibold, letterSpacing: 0.2 },
  title1: { fontVariant: lining, fontSize: 31, lineHeight: 37, fontFamily: Serif.semibold },
  title2: { fontVariant: lining, fontSize: 25, lineHeight: 31, fontFamily: Serif.semibold },
  title3: { fontVariant: lining, fontSize: 22, lineHeight: 27, fontFamily: Serif.semibold },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 17, lineHeight: 22 },
  callout: { fontSize: 16, lineHeight: 21 },
  subhead: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  /** Rótulos de seção em caixa alta, espaçados (estilo editorial). */
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.4, fontWeight: "500" as const },
};
