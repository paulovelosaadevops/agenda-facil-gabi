import { Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Avatar, EmptyState, List, Row } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import type { Client } from "@/lib/types";
import { NewClientButton } from "./client-form";
import { SearchField } from "./search-field";

export const metadata: Metadata = { title: "Clientes" };

function initialOf(name: string) {
  const letter = name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim()[0]?.toUpperCase() ?? "#";
  return /[A-Z]/.test(letter) ? letter : "#";
}

export default async function ClientsPage({ searchParams }: PageProps<"/painel/clientes">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const { db, business } = await requireBusiness();

  let query = db.from("clients").select("*").eq("business_id", business.id).order("name").limit(500);
  if (search) {
    const digits = search.replace(/\D/g, "");
    const safe = search.replace(/[%,()]/g, "");
    query = digits.length >= 3 ? query.or(`name.ilike.%${safe}%,phone.like.%${digits}%`) : query.ilike("name", `%${safe}%`);
  }
  const { data } = await query.returns<Client[]>();
  const clients = data ?? [];

  // Com poucas clientes, uma lista única; com muitas, separada por letra (como em Contatos).
  const groups = new Map<string, Client[]>();
  for (const c of clients) {
    const key = clients.length > 15 && !search ? initialOf(c.name) : "";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={search ? undefined : `${clients.length} ${clients.length === 1 ? "cliente" : "clientes"}`}
        actions={<NewClientButton />}
      />
      <SearchField initial={search} />

      {clients.length === 0 ? (
        <EmptyState icon={<Users className="size-10" strokeWidth={1.5} />} title={search ? "Nenhum resultado" : "Nenhuma cliente ainda"}>
          {search ? `Nada encontrado para “${search}”.` : "As clientes aparecem aqui quando agendam pelo link, pelo WhatsApp ou quando você cadastra."}
        </EmptyState>
      ) : (
        [...groups.entries()].map(([letter, items]) => (
          <List key={letter || "todas"} header={letter || undefined} className="mb-5">
            {items.map((c) => (
              <Row
                key={c.id}
                href={`/painel/clientes/${c.id}`}
                leading={<Avatar name={c.name} size={36} />}
                title={c.name}
                subtitle={formatPhone(c.phone)}
                chevron
              />
            ))}
          </List>
        ))
      )}
    </>
  );
}
