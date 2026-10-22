import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Platform, Share, View } from "react-native";
import { Button, Text } from "./ui";

/** URL pública da página de agendamento. */
/** Link que a Gabi compartilha: cadastro/login da cliente e agendamento. */
export function publicBookingUrl(): string {
  const base =
    process.env.EXPO_PUBLIC_APP_URL ??
    (Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "https://agenda-facil.expo.app");
  return `${base.replace(/\/$/, "")}/agendar`;
}

/** Mostra o link com botões de copiar e compartilhar (folha nativa do sistema). */
export function ShareLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = Platform.OS !== "web" || (typeof navigator !== "undefined" && "share" in navigator);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text variant="subhead" color="label2" numberOfLines={1}>
        {url.replace(/^https?:\/\//, "")}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          title={copied ? "Copiado" : "Copiar"}
          icon={copied ? "check" : "copy"}
          variant="tinted"
          style={{ height: 36, borderRadius: 18, paddingHorizontal: 14 }}
          onPress={async () => {
            await Clipboard.setStringAsync(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        />
        {canShare && (
          <Button
            title="Compartilhar"
            icon="share"
            variant="tinted"
            style={{ height: 36, borderRadius: 18, paddingHorizontal: 14 }}
            onPress={() => Share.share(Platform.OS === "ios" ? { url, message: title } : { message: `${title}: ${url}`, title })}
          />
        )}
      </View>
    </View>
  );
}
