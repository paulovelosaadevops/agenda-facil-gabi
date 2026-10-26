import type { Client } from "@shared/types.ts";
import { formatPhone } from "@shared/format.ts";
import { GroupedPickerRow, type PickerGroup } from "./grouped-picker";

type ClientOption = Pick<Client, "id" | "name" | "phone">;

/** Valor do dropdown para cadastrar uma cliente nova no próprio agendamento. */
export const NEW_CLIENT = "__nova__";

/** Inicial para agrupar (sem acento): "Ágata" → "A"; nomes que não começam com letra vão para "#". */
const initial = (name: string) => {
  const c = name.trim().normalize("NFD").charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

/**
 * Campo "Cliente" em dropdown: clientes em ordem alfabética, separadas pela inicial,
 * e "+ Nova cliente" no topo para cadastrar na hora.
 */
export function ClientPicker({ clients, value, onChange }: { clients: ClientOption[]; value: string; onChange: (value: string) => void }) {
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  const groups: PickerGroup<string>[] = [{ label: "Cadastrar", options: [{ label: "+ Nova cliente", value: NEW_CLIENT }] }];
  for (const c of sorted) {
    const letter = initial(c.name);
    let group = groups[groups.length - 1];
    if (group.label !== letter) groups.push((group = { label: letter, options: [] }));
    group.options.push({ label: c.name, detail: formatPhone(c.phone), value: c.id });
  }
  return <GroupedPickerRow label="Cliente" value={value} groups={groups} onChange={onChange} />;
}
