import { useColorScheme } from "react-native";
import { fontFamily, useTheme } from "@/lib/theme";
import { FormRow } from "./ui";

/** Web: <select> nativo do navegador, discreto e alinhado à direita como no iOS. */
export function PickerRow<T extends string | number>({
  label,
  value,
  options,
  onChange,
  last,
}: {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  last?: boolean;
}) {
  const theme = useTheme();
  // Sem isso a lista aberta usa o fundo branco do navegador com o texto claro do tema escuro.
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <FormRow label={label} last={last}>
      <select
        aria-label={label}
        value={String(value)}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
        style={{
          appearance: "none",
          background: "transparent",
          border: 0,
          outline: "none",
          color: theme.label2,
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
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} style={{ backgroundColor: theme.surface, color: theme.label, textAlign: "left" }}>
            {o.label}
          </option>
        ))}
      </select>
    </FormRow>
  );
}
