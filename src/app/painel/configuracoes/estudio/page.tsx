import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { FormRow, List, Row, RowInput } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import { saveStudio } from "../actions";
import { SettingsForm } from "../settings-form";

export const metadata: Metadata = { title: "Dados do estúdio" };

export default async function StudioPage() {
  const { business } = await requireBusiness();
  return (
    <>
      <PageHeader title="Estúdio" back={{ href: "/painel/configuracoes", label: "Ajustes" }} />
      <SettingsForm action={saveStudio}>
        <List>
          <FormRow label="Nome">
            <RowInput name="name" required defaultValue={business.name} />
          </FormRow>
          <FormRow label="WhatsApp">
            <RowInput name="phone" type="tel" defaultValue={business.phone ? formatPhone(business.phone) : ""} placeholder="(11) 99999-8888" />
          </FormRow>
          <FormRow label="Endereço">
            <RowInput name="address" defaultValue={business.address ?? ""} placeholder="Rua, número, bairro" />
          </FormRow>
        </List>
        <List footer="O endereço aparece na página de agendamento e nas confirmações enviadas às clientes.">
          <Row title="Link" detail={`/agendar/${business.slug}`} />
          <Row title="Fuso horário" detail="Brasília" />
        </List>
      </SettingsForm>
    </>
  );
}
