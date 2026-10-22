import { forwardRef } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import { fontFamily, LOGO_GOLD, Serif } from "@/lib/theme";
import { Logo } from "./logo";

export interface PosterDay {
  label: string; // "Seg 20"
  times: string[];
  /** Horários divulgados que já foram agendados: aparecem riscados. */
  taken?: string[];
}

/** Horários do dia em ordem, livres e já agendados juntos; vazio = dia ESGOTADO. */
export function posterItems(day: PosterDay): { time: string; taken: boolean }[] {
  if (!day.times.length) return [];
  return [...day.times.map((time) => ({ time, taken: false })), ...(day.taken ?? []).map((time) => ({ time, taken: true }))].sort((a, b) =>
    a.time.localeCompare(b.time),
  );
}

export const SOLD_OUT = "ESGOTADO";

export type PosterFormat = "story" | "post";

/** Largura de desenho; a captura amplia para 1080 px. */
export const POSTER_WIDTH = 360;
export const posterHeight = (format: PosterFormat) => (format === "story" ? (POSTER_WIDTH * 16) / 9 : (POSTER_WIDTH * 5) / 4);

// Fundo grafite com a logo dourada original (cores fixas: a imagem é a mesma no claro e no escuro).
const BACKGROUND = "#1D1A18";
const IVORY = "#F2ECE4";
const GOLD = LOGO_GOLD;
const MUTED = "rgba(242,236,228,0.55)";

/**
 * Arte dos horários livres da semana.
 * Mostra até 12 horários por dia para caber; o restante vira "+N". Dia sem horário marcado aparece como ESGOTADO.
 */
export const AvailabilityPoster = forwardRef<View, {
  format: PosterFormat;
  period: string;
  days: PosterDay[];
  link: string;
}>(function AvailabilityPoster({ format, period, days, link }, ref) {
  const story = format === "story";
  const visible = days;
  return (
    <View ref={ref} collapsable={false} style={[styles.poster, { height: posterHeight(format), paddingVertical: story ? 40 : 26 }]}>
      <View style={{ alignItems: "center" }}>
        <Logo width={story ? 230 : 190} color={GOLD} />
      </View>

      <View style={{ alignItems: "center", marginTop: story ? 30 : 16 }}>
        <RNText style={[styles.title, { fontSize: story ? 32 : 27 }]}>Horários disponíveis</RNText>
        <RNText style={styles.period}>{period}</RNText>
        <View style={styles.rule} />
      </View>

      <View style={{ marginTop: story ? 26 : 14, gap: story ? 14 : 8, flex: 1 }}>
        {visible.length ? (
          visible.map((d) => {
            const items = posterItems(d);
            const shown = items.slice(0, 12);
            const extra = items.length - shown.length;
            return (
              <View key={d.label} style={styles.dayRow}>
                <RNText style={styles.dayLabel}>{d.label}</RNText>
                <View style={styles.timesWrap}>
                  {items.length ? (
                    shown.map((i) => (
                      <RNText key={i.time} style={[styles.time, i.taken && styles.taken]}>
                        {i.time}
                      </RNText>
                    ))
                  ) : (
                    <RNText style={styles.soldOut}>{SOLD_OUT}</RNText>
                  )}
                  {extra > 0 && <RNText style={[styles.time, { color: GOLD }]}>+{extra}</RNText>}
                </View>
              </View>
            );
          })
        ) : (
          <RNText style={[styles.times, { textAlign: "center", marginTop: 20 }]}>Agenda completa nesta semana.</RNText>
        )}
      </View>

      <View style={{ alignItems: "center" }}>
        <RNText style={styles.footerLabel}>AGENDE PELO LINK</RNText>
        <RNText style={styles.link}>{link.replace(/^https?:\/\//, "")}</RNText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  poster: { width: POSTER_WIDTH, backgroundColor: BACKGROUND, paddingHorizontal: 28 },
  title: { fontFamily: Serif.medium, color: IVORY, textAlign: "center" },
  period: { fontFamily, fontSize: 13, color: MUTED, marginTop: 4, letterSpacing: 0.3 },
  rule: { width: 28, height: 1, backgroundColor: GOLD, marginVertical: 12 },
  dayRow: { flexDirection: "row", alignItems: "baseline", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(242,236,228,0.12)", paddingBottom: 8 },
  dayLabel: { fontFamily: Serif.semibold, fontSize: 18, color: GOLD, width: 64, fontVariant: ["lining-nums"] },
  times: { fontFamily, fontSize: 13, color: IVORY, flex: 1, lineHeight: 19, fontVariant: ["tabular-nums"] },
  timesWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 2 },
  time: { fontFamily, fontSize: 13, color: IVORY, lineHeight: 19, fontVariant: ["tabular-nums"] },
  taken: { color: MUTED, textDecorationLine: "line-through" },
  soldOut: { fontFamily, fontSize: 13, fontWeight: "600", color: GOLD, letterSpacing: 2, lineHeight: 19 },
  footerLabel: { fontFamily, fontSize: 8.5, letterSpacing: 2, color: MUTED },
  link: { fontFamily: Serif.semibold, fontSize: 15, color: GOLD, marginTop: 3 },
});
