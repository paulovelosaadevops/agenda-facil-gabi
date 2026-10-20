"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

export type ClientState = { error?: string; ok?: boolean } | undefined;

const Schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Informe o nome."),
  phone: z.string(),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  birthday: z.string().optional(),
  notes: z.string().trim().default(""),
});

export async function saveClient(_: ClientState, form: FormData): Promise<ClientState> {
  const parsed = Schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Telefone inválido. Use DDD + número." };

  const { db, business } = await requireBusiness();
  const { id, ...rest } = parsed.data;
  const row = { ...rest, phone, email: rest.email || null, birthday: rest.birthday || null };

  const result = id
    ? await db.from("clients").update(row).eq("id", id).eq("business_id", business.id).select("id").single()
    : await db.from("clients").insert({ ...row, business_id: business.id }).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") return { error: "Já existe uma cliente com esse telefone." };
    return { error: result.error.message };
  }

  revalidatePath("/painel/clientes");
  if (!id) redirect(`/painel/clientes/${result.data.id}`);
  return { ok: true };
}
