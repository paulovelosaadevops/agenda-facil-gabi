import { addDays } from "date-fns";
import * as Clipboard from "expo-clipboard";
import { useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { AvailabilityPoster, posterItems, SOLD_OUT, type PosterDay, type PosterFormat } from "@/components/availability-poster";
import { ScreenHeader } from "@/components/screen-header";
import { Segmented } from "@/components/segmented";
import { publicBookingUrl } from "@/components/share-link";
import { SlotChips } from "@/components/slot-chips";
import { Banner, Button, Loading, Screen, Text } from "@/components/ui";
import { dayBounds, toDateKey } from "@shared/availability.ts";
import { formatInTz } from "@shared/format.ts";
import { useBusiness } from "@/lib/auth";
import { Brand } from "@/lib/brand";
import { sharePoster } from "@/lib/share-image";
import { supabase } from "@/lib/supabase";
import { useGridCells, type GridCell } from "@/lib/use-grid-cells";
import { useQuery } from "@/lib/use-query";
import { rangeDays } from "@/lib/use-range-agenda";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// No computador a arte é baixada; no celular (app ou navegador) abre o compartilhar.
const downloads = Platform.OS === "web" && typeof navigator !== "undefined" && !/iPhone|iPad|Android/i.test(navigator.userAgent);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Escolhas salvas por data ("2026-10-22": ["09:00", ...]); ignora o formato antigo (por dia da semana). */
function savedSelections(raw: Record<string, string[]> | null | undefined, today: string): Record<string, string[]> {
  return Object.fromEntries(Object.entries(raw ?? {}).filter(([key]) => DATE_KEY.test(key) && key >= today));
}

/** Arte e texto com os horários que a Gabi escolhe divulgar na semana (WhatsApp e redes sociais). */
export default function ShareAvailability() {
  const business = useBusiness();
  const tz = business.timezone;
  const posterRef = useRef<View>(null);
  const [week, setWeek] = useState(0); // 0 = esta semana, 1 = próxima
  const [format, setFormat] = useState<PosterFormat>("story");
  const today = toDateKey(new Date(), tz);
  // O que está marcado em cada data é exatamente o que vai para a arte e o texto (salvo a cada toque).
  const [selections, setSelections] = useState(() => savedSelections(business.poster_times, today));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Fila de gravações: cada toque grava na hora, em ordem (a última escolha é sempre a que fica).
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const touched = useRef(false);
  // Busca as escolhas atuais no banco (os dados do estúdio em memória não acompanham o que esta tela salva).
  useQuery(async () => {
    const { data } = await supabase.from("businesses").select("poster_times").eq("id", business.id).single();
    if (!touched.current) setSelections(savedSelections(data?.poster_times, today));
    return null;
  }, [business.id]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const weekDays = useMemo(
    () => rangeDays("semana", toDateKey(addDays(new Date(), week * 7), tz), tz).filter((d) => d >= today),
    [week, tz, today],
  );
  const { data: grid, error } = useGridCells(business, weekDays);

  const weekdayOf = (date: string) => new Date(dayBounds(date, tz).start.getTime() + 12 * 3_600_000).getUTCDay();
  const free = (cells: GridCell[]) => cells.filter((c) => c.status === "free").map((c) => c.label);
  // Marcados que continuam livres...
  const selectionFor = (date: string) => (selections[date] ?? []).filter((t) => free(grid?.[date] ?? []).includes(t));
  // ...e marcados que alguém agendou depois: continuam na arte, riscados.
  const takenFor = (date: string) => {
    const booked = (grid?.[date] ?? []).filter((c) => c.status === "booked").map((c) => c.label);
    return (selections[date] ?? []).filter((t) => booked.includes(t));
  };

  const workDays = weekDays.filter((d) => grid?.[d]?.length);
  // Todo dia de atendimento entra na arte; sem horário marcado, aparece como ESGOTADO.
  const posterDays: PosterDay[] = workDays.map((d) => ({
    label: `${WEEKDAYS[weekdayOf(d)]} ${Number(d.slice(8))}`,
    times: selectionFor(d),
    taken: takenFor(d),
  }));
  const total = posterDays.length;

  const firstDay = weekDays[0] ?? today;
  const lastDay = weekDays[weekDays.length - 1] ?? today;
  const period = `${formatInTz(dayBounds(firstDay, tz).start, "d", tz)} a ${formatInTz(dayBounds(lastDay, tz).start, "d 'de' MMMM", tz)}`;
  const link = publicBookingUrl();

  /** Atualiza as escolhas de uma data e grava na hora. */
  const setDay = (date: string, times: string[]) => {
    touched.current = true;
    const next = { ...savedSelections(selections, today), [date]: [...times].sort() };
    if (!times.length) delete next[date];
    setSelections(next);
    setSaveState("saving");
    const save = saveQueue.current.then(async () => {
      const { error: e } = await supabase.from("businesses").update({ poster_times: next }).eq("id", business.id);
      // Só a última gravação da fila define o aviso.
      if (saveQueue.current === save) setSaveState(e ? "error" : "saved");
    });
    saveQueue.current = save;
  };
  const toggle = (date: string, time: string) => {
    const current = selectionFor(date);
    setDay(date, current.includes(time) ? current.filter((t) => t !== time) : [...current, time]);
  };

  const asText = () =>
    [
      `*Horários disponíveis* · ${Brand.fullName}`,
      period,
      "",
      // Já agendados riscados (~10:00~ no WhatsApp); dia sem horário marcado: ESGOTADO.
      ...posterDays.map((d) => {
        const items = posterItems(d);
        return `*${d.label}:* ${items.length ? items.map((i) => (i.taken ? `~${i.time}~` : i.time)).join(", ") : SOLD_OUT}`;
      }),
      "",
      `Agende pelo link: ${link}`,
    ].join("\n");

  const shareImage = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      const { result, omitted } = await sharePoster(posterRef, { format, period, days: posterDays, link }, "Horários disponíveis");
      if (omitted) {
        setMessage(`A arte mostrou ${total - omitted} de ${total} dias: marque menos horários ou use o formato Stories para caber todos.`);
      } else if (result === "downloaded") setMessage("Imagem baixada. Agora é só postar.");
    } catch {
      setMessage("Não foi possível gerar a imagem.");
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    await Clipboard.setStringAsync(asText());
    setMessage("Texto copiado. Cole na conversa ou no status do WhatsApp.");
  };

  return (
    <Screen>
      <ScreenHeader title="Horários livres" />
      <Segmented
        values={["Esta semana", "Próxima semana"]}
        selectedIndex={week}
        onChange={(i) => {
          setWeek(i);
          setMessage(undefined);
        }}
      />
      <View style={styles.intro}>
        <Text variant="footnote" color="label2" style={{ flex: 1 }}>
          Toque nos horários que quer divulgar. Os que forem agendados depois aparecem riscados na arte; dia sem nenhum marcado sai
          como ESGOTADO. Tudo fica salvo sozinho.
        </Text>
        <Text variant="footnote" color={saveState === "error" ? "red" : "label3"}>
          {saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo" : saveState === "error" ? "Não salvou" : ""}
        </Text>
      </View>

      {error && <Banner>{error}</Banner>}
      {!grid ? (
        <Loading />
      ) : !workDays.length ? (
        <Banner tone="info">Nenhum dia de atendimento nesta semana.</Banner>
      ) : (
        <>
          {workDays.map((date) => {
            const cells = grid[date];
            const selected = selectionFor(date);
            const allFree = free(cells);
            return (
              <View key={date} style={styles.day}>
                <View style={styles.dayHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="headline">{capitalize(formatInTz(dayBounds(date, tz).start, "EEEE, d", tz))}</Text>
                    <Text variant="footnote" color="label2">
                      {selected.length ? `${selected.length} ${selected.length === 1 ? "horário marcado" : "horários marcados"}` : "Nenhum marcado"}
                    </Text>
                  </View>
                  {allFree.length > 0 && (
                    <Pressable hitSlop={8} onPress={() => setDay(date, selected.length ? [] : allFree)}>
                      <Text variant="subhead" color="accent">
                        {selected.length ? "Limpar" : "Marcar todos livres"}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {allFree.length ? (
                  <SlotChips
                    slots={cells.map((c) => c.label)}
                    selected={selected}
                    disabled={cells.filter((c) => c.status !== "free").map((c) => c.label)}
                    onSelect={(t) => toggle(date, t)}
                  />
                ) : (
                  <Text variant="subhead" color="label2">
                    Agenda completa.
                  </Text>
                )}
              </View>
            );
          })}

          <Text variant="title3" style={{ marginTop: 8, marginBottom: 12 }}>
            Arte
          </Text>
          <Segmented values={["Stories", "Post"]} selectedIndex={format === "story" ? 0 : 1} onChange={(i) => setFormat(i ? "post" : "story")} />
          {total ? (
            <View style={styles.posterWrap}>
              <View style={styles.posterShadow}>
                <AvailabilityPoster ref={posterRef} format={format} period={period} days={posterDays} link={link} />
              </View>
            </View>
          ) : (
            <Banner tone="info">Toque nos horários acima para montar a arte.</Banner>
          )}
          {message && <Banner tone="success">{message}</Banner>}
          <Button
            title={downloads ? "Baixar imagem" : "Compartilhar imagem"}
            icon="share"
            onPress={shareImage}
            loading={busy}
            disabled={!total}
          />
          <Button title="Copiar texto para o WhatsApp" icon="copy" variant="tinted" style={{ marginTop: 10, marginBottom: 24 }} onPress={copyText} disabled={!total} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20, marginHorizontal: 4 },
  day: { marginBottom: 22 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, paddingHorizontal: 4 },
  posterWrap: { alignItems: "center", marginBottom: 20 },
  posterShadow: { borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
});
