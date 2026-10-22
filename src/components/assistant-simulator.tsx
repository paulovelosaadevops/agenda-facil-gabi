import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SIMULATOR_PHONE } from "@shared/simulator.ts";
import { useBusiness } from "@/lib/auth";
import { callFunction, supabase } from "@/lib/supabase";
import { fontFamily, Type, useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";
import { Icon } from "./icon";
import { Banner, hairline, Text } from "./ui";

interface Message {
  id: string;
  direction: "in" | "out";
  body: string;
}

const SUGGESTIONS = ["Quanto custa o alongamento?", "Tem horário sexta à tarde?", "Quero cancelar meu horário"];

/** Renderiza *negrito* do WhatsApp. */
function WhatsAppText({ text, color }: { text: string; color: string }) {
  return (
    <Text style={{ color }}>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
          <Text key={i} style={{ color, fontWeight: "700" }}>
            {part.slice(1, -1)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** Conversa de teste com a atendente: a profissional faz o papel da cliente. */
export function AssistantSimulator() {
  const theme = useTheme();
  const business = useBusiness();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();

  const { data: messages, refresh } = useQuery(async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, direction, body")
      .eq("business_id", business.id)
      .eq("phone", SIMULATOR_PHONE)
      .order("created_at")
      .limit(100)
      .returns<Message[]>();
    return data ?? [];
  });

  const send = async (value: string) => {
    const body = value.trim();
    if (!body || pending) return;
    setText("");
    setError(undefined);
    setPending(body);
    try {
      await callFunction("panel", { action: "simulator-send", text: body });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
    }
    await refresh();
    setPending(undefined);
  };

  const reset = async () => {
    await callFunction("panel", { action: "simulator-reset" }).catch(() => {});
    await refresh();
  };

  const list: Message[] = [...(messages ?? []), ...(pending ? [{ id: "pending", direction: "in" as const, body: pending }] : [])];

  return (
    <View style={[styles.box, { backgroundColor: theme.surface }]}>
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <View style={{ width: 28 }} />
        <View style={{ alignItems: "center" }}>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            Cliente de teste
          </Text>
          <Text variant="caption" color="label2">
            {pending ? "digitando…" : "simulação · agenda real"}
          </Text>
        </View>
        <Pressable onPress={reset} hitSlop={10} accessibilityLabel="Reiniciar conversa">
          <Icon name="refresh" size={20} color={theme.accent} />
        </Pressable>
      </View>

      <View style={styles.messages}>
        {list.length === 0 ? (
          <View style={{ alignItems: "center", gap: 14, paddingVertical: 24 }}>
            <Text variant="subhead" color="label2" style={{ textAlign: "center" }}>
              Escreva como se fosse uma cliente. A atendente consulta seus serviços e horários de verdade.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => send(s)} style={[styles.suggestion, { backgroundColor: theme.fill }]}>
                  <Text variant="footnote" style={{ fontWeight: "500" }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          list.map((m, i) => {
            const mine = m.direction === "in";
            const last = list[i + 1]?.direction !== m.direction;
            return (
              <View key={m.id} style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: last ? 8 : 2 }}>
                <View
                  style={[
                    styles.bubble,
                    { backgroundColor: mine ? theme.accentStrong : theme.fill },
                    last && (mine ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }),
                  ]}
                >
                  <WhatsAppText text={m.body} color={mine ? theme.onAccent : theme.label} />
                </View>
              </View>
            );
          })
        )}
        {pending && (
          <View style={[styles.bubble, { backgroundColor: theme.fill, alignSelf: "flex-start" }]}>
            <ActivityIndicator size="small" />
          </View>
        )}
      </View>

      {error && (
        <View style={{ paddingHorizontal: 12 }}>
          <Banner>{error}</Banner>
        </View>
      )}

      <View style={[styles.composer, { borderTopColor: theme.separator }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Mensagem"
          placeholderTextColor={theme.label3}
          onSubmitEditing={() => send(text)}
          returnKeyType="send"
          style={[Type.body, styles.input, { color: theme.label, borderColor: theme.separator, fontFamily }]}
        />
        <Pressable
          onPress={() => send(text)}
          disabled={!text.trim() || Boolean(pending)}
          accessibilityLabel="Enviar"
          style={[styles.send, { backgroundColor: text.trim() && !pending ? theme.accentStrong : theme.fill }]}
        >
          <Icon name="arrowUp" size={18} color={text.trim() && !pending ? theme.onAccent : theme.label3} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, overflow: "hidden", borderCurve: "continuous" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: hairline },
  messages: { padding: 12, minHeight: 320 },
  bubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  suggestion: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderTopWidth: hairline },
  input: { flex: 1, height: 36, borderRadius: 18, borderWidth: hairline, paddingHorizontal: 14, paddingVertical: 0, outlineWidth: 0 },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
