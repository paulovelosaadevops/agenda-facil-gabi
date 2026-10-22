import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { callFunction } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Icon } from "./icon";
import { Segmented } from "./segmented";
import { Banner, Button, Section, Text, TextAreaRow } from "./ui";

const TONES = [
  { label: "Elegante", value: "delicado e elegante" },
  { label: "Divertido", value: "divertido e descontraído" },
  { label: "Minimalista", value: "sofisticado e minimalista" },
  { label: "Promoção", value: "promocional, com senso de urgência" },
];

interface Result {
  legendas: { estilo: string; texto: string }[];
  hashtags: string[];
}

function CopyButton({ text }: { text: string }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      hitSlop={8}
      onPress={async () => {
        await Clipboard.setStringAsync(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <Icon name={copied ? "check" : "copy"} size={14} color={theme.accent} />
      <Text variant="footnote" color="accent" style={{ fontWeight: "600" }}>
        {copied ? "Copiado" : "Copiar"}
      </Text>
    </Pressable>
  );
}

export function CaptionGenerator() {
  const theme = useTheme();
  const [photo, setPhoto] = useState<{ uri: string; base64: string; mimeType: string }>();
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState(0);
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true, allowsEditing: true });
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    // Na web o base64 pode vir só dentro da data URL.
    const base64 = asset.base64 ?? asset.uri.split(",")[1] ?? "";
    setPhoto({ uri: asset.uri, base64, mimeType: asset.mimeType ?? "image/jpeg" });
  };

  const generate = async () => {
    setError(undefined);
    setLoading(true);
    try {
      setResult(
        await callFunction<Result>("panel", {
          action: "captions",
          description,
          tone: TONES[tone].value,
          image: photo ? { base64: photo.base64, mediaType: photo.mimeType } : undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar as legendas.");
    } finally {
      setLoading(false);
    }
  };

  const hashtags = result?.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ") ?? "";

  return (
    <View>
      <Pressable
        onPress={pick}
        style={[styles.photo, { backgroundColor: theme.surface, borderColor: photo ? "transparent" : theme.separator }]}
        accessibilityRole="button"
        accessibilityLabel="Escolher foto"
      >
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.change}>
              <Text variant="footnote" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Trocar foto
              </Text>
            </View>
          </>
        ) : (
          <>
            <Icon name="photo" size={34} color={theme.accent} />
            <Text color="accent" style={{ marginTop: 8, fontWeight: "500" }}>
              Escolher foto
            </Text>
            <Text variant="footnote" color="label2">
              Do trabalho finalizado
            </Text>
          </>
        )}
      </Pressable>

      <Section header="Sobre o trabalho">
        <TextAreaRow value={description} onChangeText={setDescription} placeholder="Ex.: alongamento em gel, francesinha com glitter dourado" />
      </Section>

      <Text variant="footnote" color="label2" style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        TOM
      </Text>
      <Segmented values={TONES.map((t) => t.label)} selectedIndex={tone} onChange={setTone} />

      {error && <Banner>{error}</Banner>}
      <Button title="Gerar legendas" icon="sparkles" onPress={generate} loading={loading} disabled={!photo && !description.trim()} />

      {result && (
        <View style={{ marginTop: 28, gap: 12 }}>
          {[...result.legendas.map((l) => ({ title: l.estilo, text: l.texto, copy: `${l.texto}\n\n${hashtags}` })), { title: "Hashtags", text: hashtags, copy: hashtags }].map(
            (card, i) => (
              <View key={i} style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.cardHeader}>
                  <Text variant="footnote" color="label2" style={{ fontWeight: "600" }}>
                    {card.title}
                  </Text>
                  <CopyButton text={card.copy} />
                </View>
                <Text style={card.title === "Hashtags" ? { color: theme.accent } : undefined}>{card.text}</Text>
              </View>
            ),
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    aspectRatio: 4 / 3,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 28,
    borderCurve: "continuous",
  },
  change: { position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  card: { borderRadius: 16, padding: 16, gap: 8, borderCurve: "continuous" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
