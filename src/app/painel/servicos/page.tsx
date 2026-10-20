import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireBusiness } from "@/lib/auth";
import type { Service } from "@/lib/types";
import { NewServiceButton, ServiceList } from "./service-list";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage() {
  const { db, business } = await requireBusiness();
  const { data } = await db
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .order("name")
    .returns<Service[]>();

  return (
    <>
      <PageHeader title="Serviços" back={{ href: "/painel/configuracoes", label: "Ajustes" }} actions={<NewServiceButton />} />
      <ServiceList services={data ?? []} />
    </>
  );
}
