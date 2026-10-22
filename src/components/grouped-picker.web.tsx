import { useColorScheme } from "react-native";
import { fontFamily, useTheme } from "@/lib/theme";
import type { PickerGroup } from "./grouped-picker";
import { FormRow } from "./ui";

export type { PickerGroup } from "./grouped-picker";

/** Web: <select> nativo com <optgroup>, nas cores do tema (igual ao PickerRow da web). */
export function GroupedPickerRow<T extends string>({
  label,
  value,
  groups,
  onChange,
  placeholder = "Escolher",
}: {
  label: string;
  value: T | "";
  groups: PickerGroup<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  // Sem isso a lista aberta usa o fundo branco do navegador com o texto claro do tema escuro.
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const itemStyle = { backgroundColor: theme.surface, color: theme.label, textAlign: "left" as const };
  return (
    <FormRow label={label}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value as T)}
        style={{
          appearance: "none",
          background: "transparent",
          border: 0,
          outline: "none",
          color: value ? theme.label : theme.label2,
          fontFamily,
          fontSize: 17,
          textAlign: "right",
          textAlignLast: "right",
          maxWidth: "100%",
          cursor: "pointer",
          colorScheme,
          paddingRight: 16,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='14' viewBox='0 0 10 14'%3E%3Cpath d='M1 5l4-4 4 4M1 9l4 4 4-4' stroke='%238e8e93' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right center",
        }}
      >
        <option value="" disabled style={itemStyle}>
          {placeholder}
        </option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label} style={{ ...itemStyle, color: theme.label2 }}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value} style={itemStyle}>
                {o.detail ? `${o.label} · ${o.detail}` : o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </FormRow>
  );
}
