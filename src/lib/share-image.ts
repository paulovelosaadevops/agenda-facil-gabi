import * as Sharing from "expo-sharing";
import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { POSTER_WIDTH, posterHeight } from "@/components/availability-poster";
import type { PosterData } from "./poster-canvas";

export interface ShareResult {
  result: "shared" | "downloaded";
  /** Dias que não couberam na arte. */
  omitted: number;
}

/** Celular (app nativo): captura a arte em 1080 px e abre a folha de compartilhamento (WhatsApp, Instagram...). */
export async function sharePoster(ref: RefObject<View | null>, poster: PosterData, title: string): Promise<ShareResult> {
  if (!ref.current) return { result: "shared", omitted: 0 };
  const size = { width: 1080, height: Math.round((1080 * posterHeight(poster.format)) / POSTER_WIDTH) };
  const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile", ...size });
  await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: title, UTI: "public.png" });
  return { result: "shared", omitted: 0 };
}
