"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth";
import { parseMoney } from "@/lib/format";

export type ServiceState = { error?: string; ok?: boolean } | undefined;

const Schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Informe o nome do serviço."),
  description: z.string().trim().default(""),
  duration_min: z.coerce.number().int().min(5, "Duração mínima de 5 minutos.").max(600),
  price: z.string().default("0"),
});

export async function saveService(_: ServiceState, form: FormData): Promise<ServiceState> {
  const parsed = Schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { db, business } = await requireBusiness();
  const { id, price, ...fields } = parsed.data;
  const row = { ...fields, price_cents: parseMoney(price), active: form.get("active") === "on" };

  const { error } = id
    ? await db.from("services").update(row).eq("id", id).eq("business_id", business.id)
    : await db.from("services").insert({ ...row, business_id: business.id });
  if (error) return { error: error.message };

  revalidatePath("/painel", "layout");
  return { ok: true };
}
