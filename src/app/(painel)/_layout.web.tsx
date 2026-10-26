import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from "expo-router/ui";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text as RNText, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { Logo } from "@/components/logo";
import { hairline, Text } from "@/components/ui";
import { useBusiness } from "@/lib/auth";
import { fontFamily, useTheme } from "@/lib/theme";

const TABS: { name: string; href: "/inicio" | "/agenda" | "/clientes" | "/ajustes"; label: string; icon: IconName }[] = [
  { name: "inicio", href: "/inicio", label: "Início", icon: "home" },
  { name: "agenda", href: "/agenda", label: "Agenda", icon: "calendar" },
  { name: "clientes", href: "/clientes", label: "Clientes", icon: "people" },
  { name: "ajustes", href: "/ajustes", label: "Ajustes", icon: "gear" },
];

type TabButtonProps = TabTriggerSlotProps & { label: string; icon: IconName; sidebar: boolean };

// React 19: o ref do TabTrigger chega como prop comum e segue para o Pressable.
function TabButton({ isFocused, label, icon, sidebar, ...props }: TabButtonProps) {
  const theme = useTheme();
  const color = isFocused ? theme.accent : sidebar ? theme.label : theme.label2;
  return (
    <Pressable
      {...(props as ComponentProps<typeof Pressable>)}
      style={(state) => [
        sidebar ? styles.sideItem : styles.bottomItem,
        sidebar &&
          (isFocused
            ? { backgroundColor: theme.fill }
            : (state as { hovered?: boolean }).hovered && { backgroundColor: theme.fill2 }),
      ]}
    >
      <Icon name={icon} size={sidebar ? 20 : 24} color={sidebar ? theme.accent : color} />
      <RNText style={[sidebar ? styles.sideLabel : styles.bottomLabel, { color, fontFamily, fontWeight: isFocused ? "600" : "400" }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

function StudioName() {
  const business = useBusiness();
  return (
    <Text variant="footnote" color="label2" numberOfLines={1} style={{ paddingHorizontal: 10 }}>
      {business.name}
    </Text>
  );
}

// Na web não há barra de abas do sistema: barra lateral no computador, barra inferior no celular.
export default function PanelTabsWeb() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sidebar = width >= 768;

  return (
    <Tabs style={{ flexDirection: sidebar ? "row-reverse" : "column", flex: 1, backgroundColor: theme.bg }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={
          sidebar
            ? [styles.sidebar, { backgroundColor: theme.surface, borderRightColor: theme.separator }]
            : // App instalado no iPhone (PWA em tela cheia): a barra fica acima do indicador de gestos.
              [styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.separator, paddingBottom: insets.bottom }]
        }
      >
        {sidebar && (
          <View style={styles.brand}>
            <Logo width={170} />
          </View>
        )}
        {TABS.map((t) => (
          // resetOnFocus: tocar na aba sempre abre a tela principal dela. Sem isso, um "Novo agendamento" aberto
          // pelo Início e fechado pelo histórico do navegador ficava no topo da Agenda.
          <TabTrigger key={t.name} name={t.name} href={t.href} resetOnFocus asChild>
            <TabButton label={t.label} icon={t.icon} sidebar={sidebar} />
          </TabTrigger>
        ))}
        {sidebar && (
          <View style={{ marginTop: "auto" }}>
            <StudioName />
          </View>
        )}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 232,
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: 2,
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 16,
    borderRightWidth: hairline,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, marginBottom: 20 },
  sideItem: { flexDirection: "row", alignItems: "center", gap: 10, height: 36, paddingHorizontal: 10, borderRadius: 8 },
  sideLabel: { fontSize: 14 },
  bottomBar: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: hairline },
  bottomItem: { flex: 1, alignItems: "center", gap: 2, paddingTop: 7, paddingBottom: 5 },
  bottomLabel: { fontSize: 10 },
});
