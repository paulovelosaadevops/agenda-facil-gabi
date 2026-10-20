import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireBusiness } from "@/lib/auth";
import type { WorkingHours } from "@/lib/types";
import { saveWorkingHours } from "../actions";
import { SettingsForm } from "../settings-form";
import { HoursFields } from "./hours-form";

export const metadata: Metadata = { title: "Expediente" };

export default async function WorkingHoursPage() {
  const { db, business } = await requireBusiness();
  const { data } = await db.from("working_hours").select("*").eq("business_id", business.id).returns<WorkingHours[]>();
  return (
    <>
      <PageHeader title="Expediente" back={{ href: "/painel/configuracoes", label: "Ajustes" }} />
      <SettingsForm action={saveWorkingHours}>
        <HoursFields hours={data ?? []} />
      </SettingsForm>
    </>
  );
}
