import type { RefObject } from "react";
import type { View } from "react-native";
import { renderPoster, type PosterData } from "./poster-canvas";

export interface ShareResult {
  result: "shared" | "downloaded";
  /** Dias que não couberam na arte. */
  omitted: number;
}

/**
 * Web: desenha a arte (igual à prévia) e abre o compartilhar do celular (Instagram, WhatsApp, Salvar imagem).
 * Onde o navegador não compartilha arquivos (computador), baixa o PNG.
 */
export async function sharePoster(_ref: RefObject<View | null>, poster: PosterData, title: string): Promise<ShareResult> {
  const { blob, drawn, total } = await renderPoster(poster);
  const omitted = total - drawn;
  const name = `${title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")}.png`;
  const file = new File([blob], name, { type: "image/png" });

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title });
      return { result: "shared", omitted };
    } catch (err) {
      // Fechou a folha de compartilhamento: não é erro.
      if (err instanceof DOMException && err.name === "AbortError") return { result: "shared", omitted };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { result: "downloaded", omitted };
}
