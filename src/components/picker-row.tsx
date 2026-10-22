import { Host, Picker } from "@expo/ui";
import { FormRow } from "./ui";

/** Linha com seletor em menu: menu nativo no iOS, dropdown no Android, <select> na web. */
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
  return (
    <FormRow label={label} last={last}>
      <Host matchContents>
        <Picker selectedValue={value} onValueChange={(v) => onChange(v as T)}>
          {options.map((o) => (
            <Picker.Item key={String(o.value)} label={o.label} value={o.value} />
          ))}
        </Picker>
      </Host>
    </FormRow>
  );
}
