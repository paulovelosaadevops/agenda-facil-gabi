import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { ScreenHeader } from "@/components/screen-header";
import { Avatar, Banner, EmptyState, HeaderButton, Input, Loading, Row, Screen, Section } from "@/components/ui";
import { formatPhone } from "@shared/format.ts";
import type { Client } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function initialOf(name: string) {
  const letter = normalize(name).trim()[0]?.toUpperCase() ?? "#";
  return /[A-Z]/.test(letter) ? letter : "#";
}

export default function ClientsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const business = useBusiness();
  const [search, setSearch] = useState("");

  const { data, error, loading, refreshing, refresh } = useQuery(async () => {
    const { data: rows, error: e } = await supabase.from("clients").select("*").eq("business_id", business.id).order("name").returns<Client[]>();
    if (e) throw e;
    return rows;
  });

  const groups = useMemo(() => {
    const q = normalize(search.trim());
    const digits = search.replace(/\D/g, "");
    const list = (data ?? []).filter((c) => !q || normalize(c.name).includes(q) || (digits.length >= 3 && c.phone.includes(digits)));
    // Com poucas clientes, lista única; com muitas, separada por letra (como em Contatos).
    const byLetter = list.length > 15 && !q;
    const map = new Map<string, Client[]>();
    for (const c of list) {
      const key = byLetter ? initialOf(c.name) : "";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.entries()];
  }, [data, search]);

  const total = data?.length ?? 0;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader
        title="Clientes"
        large
        subtitle={Platform.OS === "web" ? `${total} ${total === 1 ? "cliente" : "clientes"}` : undefined}
        right={<HeaderButton icon="plus" accessibilityLabel="Nova cliente" onPress={() => router.push("/clientes/form")} />}
      />
      {/* Busca nativa no cabeçalho (iOS/Android); na web, um campo no conteúdo. */}
      {Platform.OS !== "web" ? (
        <Stack.Screen
          options={{
            headerSearchBarOptions: {
              placeholder: "Buscar",
              hideWhenScrolling: false,
              onChangeText: (e) => setSearch(e.nativeEvent.text),
              onCancelButtonPress: () => setSearch(""),
            },
          }}
        />
      ) : (
        <View style={{ backgroundColor: theme.fill, borderRadius: 10, paddingHorizontal: 12, height: 38, justifyContent: "center", marginBottom: 20 }}>
          <Input value={search} onChangeText={setSearch} placeholder="Buscar por nome ou telefone" style={{ textAlign: "left" }} />
        </View>
      )}

      {error && <Banner>{error}</Banner>}
      {loading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="people"
          title={search ? "Nenhum resultado" : "Nenhuma cliente ainda"}
          message={search ? `Nada encontrado para “${search}”.` : "As clientes aparecem aqui quando agendam pelo link, pelo WhatsApp ou quando você cadastra."}
        />
      ) : (
        groups.map(([letter, items]) => (
          <Section key={letter || "todas"} header={letter || undefined} style={{ marginBottom: 20 }}>
            {items.map((c) => (
              <Row
                key={c.id}
                href={`/clientes/${c.id}`}
                leading={<Avatar name={c.name} size={36} />}
                inset={64}
                title={c.name}
                subtitle={formatPhone(c.phone)}
                chevron
              />
            ))}
          </Section>
        ))
      )}
    </Screen>
  );
}
