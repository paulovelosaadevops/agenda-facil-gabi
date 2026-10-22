import { useMemo } from "react";
import type { Client } from "@shared/types.ts";
import { formatPhone } from "@shared/format.ts";
import { Avatar, FormRow, Input, Row } from "./ui";

type ClientOption = Pick<Client, "id" | "name" | "phone">;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Campo "Cliente" com sugestões enquanto digita. Escolher uma sugestão seleciona a cliente;
 * se não houver, a pessoa digitada vira uma cliente nova (e o formulário pede o WhatsApp).
 */
export function ClientPicker({
  clients,
  query,
  onQueryChange,
  selected,
  onSelect,
}: {
  clients: ClientOption[];
  query: string;
  onQueryChange: (q: string) => void;
  selected?: ClientOption;
  onSelect: (c?: ClientOption) => void;
}) {
  const matches = useMemo(() => {
    const q = normalize(query);
    const digits = query.replace(/\D/g, "");
    if (!q || selected) return [];
    return clients
      .filter((c) => normalize(c.name).includes(q) || (digits.length >= 3 && c.phone.includes(digits)))
      .slice(0, 5);
  }, [clients, query, selected]);

  return (
    <>
      <FormRow label="Cliente" last={matches.length === 0}>
        <Input
          value={query}
          placeholder="Nome ou telefone"
          autoCorrect={false}
          onChangeText={(v) => {
            onQueryChange(v);
            if (selected) onSelect(undefined);
          }}
        />
      </FormRow>
      {matches.map((c) => (
        <Row
          key={c.id}
          leading={<Avatar name={c.name} size={30} />}
          title={c.name}
          subtitle={formatPhone(c.phone)}
          onPress={() => {
            onSelect(c);
            onQueryChange(c.name);
          }}
        />
      ))}
    </>
  );
}
