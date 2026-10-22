import { Image } from "react-native";
import { useTheme } from "@/lib/theme";

const LOGO = require("../../assets/images/logo.png");

/** Proporção do arquivo da logo (recortado sem sobras). */
export const LOGO_RATIO = 1093 / 362;

/**
 * Logo da Gabi (assinatura "Gabi Marqui" com a unha, estrelinhas e "NAIL DESIGNER").
 * O arquivo é dourado com fundo transparente; `color` repinta (no claro usa o tom de destaque).
 */
export function Logo({ width = 240, color }: { width?: number; color?: string }) {
  const theme = useTheme();
  return (
    <Image
      source={LOGO}
      accessibilityRole="image"
      accessibilityLabel="Gabi Marqui Nail Designer"
      style={{ width, height: width / LOGO_RATIO, tintColor: color ?? theme.logo }}
      resizeMode="contain"
    />
  );
}
