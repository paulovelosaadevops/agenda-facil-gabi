import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { fontFamily, useTheme } from "@/lib/theme";
import { useNotifications } from "@/lib/use-notifications";
import { Icon } from "./icon";
import { tap } from "./ui";

/** Sino do cabeçalho com o número de agendamentos novos ainda não vistos. */
export function BellButton({ businessId }: { businessId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { unread } = useNotifications(businessId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notificações: ${unread} novas` : "Notificações"}
      hitSlop={10}
      onPress={() => {
        tap();
        router.push("/inicio/notificacoes");
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Icon name={unread ? "bellOn" : "bell"} size={22} color={theme.accent} weight="medium" />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.red, borderColor: theme.bg }]}>
          <RNText style={[styles.badgeText, { fontFamily }]}>{unread > 9 ? "9+" : unread}</RNText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
});
