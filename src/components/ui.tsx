import * as Haptics from "expo-haptics";
import { Link, type Href } from "expo-router";
import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { fontFamily, Serif, Type, useTheme, type Theme } from "@/lib/theme";
import { Icon, type IconName } from "./icon";

export const hairline = StyleSheet.hairlineWidth;

export function tap() {
  if (Platform.OS === "ios") void Haptics.selectionAsync();
}

/* ---------- Texto ---------- */

type TextVariant = keyof typeof Type;
type TextColor = "label" | "label2" | "label3" | "accent" | "champagne" | "red" | "green" | "orange" | "blue" | "onAccent";

/** Família da variante: títulos usam a serifada; o resto, a fonte do sistema. */
export function familyOf(variant: TextVariant): string | undefined {
  const t = Type[variant] as { fontFamily?: string };
  return t.fontFamily ?? fontFamily;
}

/** Cor com transparência a partir de um hex do tema ("#RRGGBB"). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function Text({
  variant = "body",
  color = "label",
  style,
  ...props
}: ComponentProps<typeof RNText> & { variant?: TextVariant; color?: TextColor }) {
  const theme = useTheme();
  return <RNText style={[Type[variant], { color: theme[color], fontFamily: familyOf(variant) }, style]} {...props} />;
}

/* ---------- Tela ---------- */

/**
 * Conteúdo rolável da tela. Precisa ser o primeiro filho da tela para o título grande
 * do iOS encolher ao rolar (contentInsetAdjustmentBehavior).
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  keyboard,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={keyboard ? "interactive" : "on-drag"}
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
      contentContainerStyle={[styles.screenContent, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

/* ---------- Listas agrupadas ---------- */

/** Seção agrupada (como no app Ajustes). Insere separadores entre as linhas. */
export function Section({
  header,
  footer,
  children,
  style,
}: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ last?: boolean }>[];
  return (
    <View style={[styles.section, style]}>
      {header && (
        <Text variant="overline" color="label2" style={styles.sectionHeader}>
          {header.toUpperCase()}
        </Text>
      )}
      <View style={[styles.sectionBody, { backgroundColor: theme.surface }]}>
        {items.map((child, i) => cloneElement(child, { last: i === items.length - 1 }))}
      </View>
      {footer != null &&
        (typeof footer === "string" ? (
          <Text variant="footnote" color="label2" style={styles.sectionFooter}>
            {footer}
          </Text>
        ) : (
          <View style={styles.sectionFooter}>{footer}</View>
        ))}
    </View>
  );
}

function Separator({ inset, theme }: { inset: number; theme: Theme }) {
  return <View style={{ height: hairline, backgroundColor: theme.separator, marginLeft: inset }} />;
}

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  tone?: "default" | "accent" | "destructive" | "muted";
  href?: Href;
  onPress?: () => void;
  last?: boolean;
  /** Recuo do separador quando há ícone/avatar à esquerda. */
  inset?: number;
  numberOfLines?: number;
}

export function Row({
  title,
  subtitle,
  detail,
  leading,
  trailing,
  chevron,
  tone = "default",
  href,
  onPress,
  last,
  inset,
  numberOfLines = 1,
}: RowProps) {
  const theme = useTheme();
  const titleColor = tone === "accent" ? "accent" : tone === "destructive" ? "red" : tone === "muted" ? "label2" : "label";
  const content = (pressed: boolean) => (
    <View>
      <View style={[styles.row, pressed && { backgroundColor: theme.fill }]}>
        {leading}
        <View style={styles.rowText}>
          {typeof title === "string" ? (
            <Text color={titleColor} numberOfLines={numberOfLines}>
              {title}
            </Text>
          ) : (
            title
          )}
          {subtitle != null &&
            (typeof subtitle === "string" ? (
              <Text variant="subhead" color="label2" numberOfLines={1} style={{ marginTop: 1 }}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            ))}
        </View>
        {detail != null &&
          (typeof detail === "string" || typeof detail === "number" ? (
            <Text color="label2" numberOfLines={1} style={styles.rowDetail}>
              {detail}
            </Text>
          ) : (
            detail
          ))}
        {trailing}
        {chevron && <Icon name="chevronRight" size={14} color={theme.label3} weight="semibold" />}
      </View>
      {!last && <Separator inset={inset ?? (leading ? 62 : 16)} theme={theme} />}
    </View>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable onPressIn={tap}>{({ pressed }) => content(pressed)}</Pressable>
      </Link>
    );
  }
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        accessibilityRole="button"
      >
        {({ pressed }) => content(pressed)}
      </Pressable>
    );
  }
  return content(false);
}

/** Ícone de linha em tom único (champagne sobre fundo suave), sem as cores de sistema. */
export function RowIcon({ name, tone = "default" }: { name: IconName; tone?: "default" | "destructive" }) {
  const theme = useTheme();
  const color = tone === "destructive" ? theme.red : theme.accent;
  return (
    <View style={[styles.rowIcon, { backgroundColor: tone === "destructive" ? withAlpha(theme.red, 0.1) : theme.accentTint }]}>
      <Icon name={name} size={17} color={color} />
    </View>
  );
}

/* ---------- Formulários ---------- */

export function FormRow({
  label,
  last,
  children,
  stacked,
}: {
  label: string;
  last?: boolean;
  children: ReactNode;
  stacked?: boolean;
}) {
  const theme = useTheme();
  return (
    <View>
      <View style={[styles.row, stacked && { flexDirection: "column", alignItems: "stretch", gap: 4 }]}>
        <Text variant={stacked ? "footnote" : "body"} color={stacked ? "label2" : "label"} style={!stacked && styles.formLabel}>
          {label}
        </Text>
        <View style={{ flex: stacked ? undefined : 1, alignItems: stacked ? "stretch" : "flex-end" }}>{children}</View>
      </View>
      {!last && <Separator inset={16} theme={theme} />}
    </View>
  );
}

export function Input({ style, multiline, ...props }: ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.label3}
      selectionColor={theme.accent}
      multiline={multiline}
      style={[
        Type.body,
        styles.input,
        { color: theme.label, fontFamily, textAlign: multiline ? "left" : "right" },
        Platform.OS === "web" && styles.webNoOutline,
        style,
      ]}
      {...props}
    />
  );
}

/** Área de texto ocupando a linha toda. */
export function TextAreaRow({ last, ...props }: ComponentProps<typeof TextInput> & { last?: boolean }) {
  const theme = useTheme();
  return (
    <View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <Input multiline textAlignVertical="top" style={{ minHeight: 88 }} {...props} />
      </View>
      {!last && <Separator inset={16} theme={theme} />}
    </View>
  );
}

export function Switch(props: ComponentProps<typeof RNSwitch>) {
  const theme = useTheme();
  return (
    <RNSwitch
      trackColor={{ true: theme.champagne, false: theme.fill }}
      thumbColor="#FFFFFF"
      // Web: sem isto a bolinha ligada fica na cor padrão (verde-azulado).
      {...(Platform.OS === "web" ? { activeThumbColor: "#FFFFFF" } : null)}
      ios_backgroundColor={theme.fill}
      {...props}
    />
  );
}

export function SwitchRow({
  label,
  subtitle,
  value,
  onValueChange,
  last,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <Row
      title={label}
      subtitle={subtitle}
      last={last}
      trailing={<Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} />}
    />
  );
}

/* ---------- Botões ---------- */

export function Button({
  title,
  onPress,
  variant = "filled",
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "filled" | "tinted" | "plain" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bg =
    variant === "filled"
      ? theme.accentStrong
      : variant === "tinted"
        ? theme.accentTint
        : variant === "destructive"
          ? withAlpha(theme.red, 0.1)
          : "transparent";
  const fg = variant === "filled" ? theme.onAccent : variant === "destructive" ? theme.red : theme.accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        variant === "plain" && { paddingHorizontal: 0, height: undefined },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={fg} />}
          <RNText style={[Type.headline, { color: fg, fontFamily, fontWeight: "500", letterSpacing: 0.3 }]}>{title}</RNText>
        </>
      )}
    </Pressable>
  );
}

/** Botão de barra de navegação (ícone ou texto). */
export function HeaderButton({
  icon,
  title,
  onPress,
  accessibilityLabel,
  bold,
}: {
  icon?: IconName;
  title?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  bold?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      hitSlop={10}
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.5 : 1 }]}
    >
      {icon ? (
        <Icon name={icon} size={22} color={theme.accent} weight="medium" />
      ) : (
        <RNText style={[Type.body, { color: theme.accent, fontWeight: bold ? "600" : "400", fontFamily }]}>{title}</RNText>
      )}
    </Pressable>
  );
}

/* ---------- Diversos ---------- */

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const theme = useTheme();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accentTint }]}>
      <RNText style={{ color: theme.accent, fontSize: size * 0.42, fontFamily: Serif.semibold }}>{initials || "?"}</RNText>
    </View>
  );
}

export function Banner({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: ReactNode }) {
  const theme = useTheme();
  const color = tone === "error" ? theme.red : tone === "success" ? theme.green : theme.accent;
  return (
    <View style={[styles.banner, { backgroundColor: withAlpha(tone === "info" ? theme.champagne : color, 0.12) }]}>
      <RNText style={[Type.footnote, { color, fontFamily }]}>{children}</RNText>
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon?: IconName; title: string; message?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      {icon && <Icon name={icon} size={44} color={theme.label3} />}
      <Text variant="headline" style={{ marginTop: 12, textAlign: "center" }}>
        {title}
      </Text>
      {message && (
        <Text variant="subhead" color="label2" style={{ marginTop: 4, textAlign: "center", maxWidth: 300 }}>
          {message}
        </Text>
      )}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator />
    </View>
  );
}

/** Monograma: iniciais em serifada champagne sobre grafite (ou as iniciais do estúdio). */
export function AppMark({ size = 32, name }: { size?: number; name?: string }) {
  const letters = name
    ? name
        .replace(/\b(studio|estúdio|espaço|nails?|unhas?|de|da|do)\b/gi, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("") || name[0].toUpperCase()
    : "A";
  return (
    <View style={[styles.appMark, { width: size, height: size, borderRadius: size * 0.225 }]}>
      <RNText
        style={{
          color: "#D9C3A5",
          fontFamily: Serif.medium,
          fontSize: size * (letters.length > 1 ? 0.46 : 0.62),
          lineHeight: size * 0.9,
          letterSpacing: letters.length > 1 ? 0.5 : 0,
          includeFontPadding: false,
          textAlign: "center",
        }}
      >
        {letters}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  section: { marginBottom: 28 },
  sectionHeader: { paddingHorizontal: 16, paddingBottom: 6 },
  sectionFooter: { paddingHorizontal: 16, paddingTop: 6 },
  sectionBody: { borderRadius: 12, overflow: "hidden", borderCurve: "continuous" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowDetail: { maxWidth: "55%", textAlign: "right" },
  rowIcon: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  formLabel: { width: 120 },
  input: { paddingVertical: 0, flexGrow: 1, alignSelf: "stretch", minHeight: 24 },
  webNoOutline: { outlineWidth: 0 },
  button: {
    height: 50,
    borderRadius: 14,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  headerButton: { paddingHorizontal: 4, minWidth: 28, minHeight: 28, alignItems: "center", justifyContent: "center" },
  avatar: { alignItems: "center", justifyContent: "center" },
  banner: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, borderCurve: "continuous" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 56, paddingHorizontal: 24 },
  // Grafite fixo (também no modo escuro): é a marca, não um elemento do tema.
  appMark: { backgroundColor: "#2B2724", alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
});
