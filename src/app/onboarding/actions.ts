"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizePhone } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";

export type OnboardingState = { error?: string } | undefined;

const Schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do estúdio."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "O link deve ter de 3 a 40 letras minúsculas, números ou hífen."),
  phone: z.string().optional(),
});

const DEFAULT_SERVICES = [
  { name: "Manicure", duration_min: 45, price_cents: 4000 },
  { name: "Pedicure", duration_min: 50, price_cents: 4500 },
  { name: "Alongamento em gel", duration_min: 150, price_cents: 18000 },
  { name: "Manutenção de gel", duration_min: 120, price_cents: 13000 },
  { name: "Esmaltação em gel", duration_min: 60, price_cents: 7000 },
];

export async function createBusiness(_: OnboardingState, form: FormData): Promise<OnboardingState> {
  const parsed = Schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await createSupabaseServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) redirect("/login");

  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  const { data: business, error } = await db
    .from("businesses")
    .insert({ owner_id: auth.user.id, name: parsed.data.name, slug: parsed.data.slug, phone })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Esse link já está em uso. Escolha outro." };
    return { error: error.message };
  }

  // Terça a sábado, 9h–12h e 13h–19h. Ela ajusta depois em Configurações.
  const hours = [2, 3, 4, 5, 6].flatMap((weekday) => [
    { business_id: business.id, weekday, start_time: "09:00", end_time: "12:00" },
    { business_id: business.id, weekday, start_time: "13:00", end_time: "19:00" },
  ]);
  const services = DEFAULT_SERVICES.map((s) => ({ ...s, business_id: business.id }));
  const [h, s] = await Promise.all([db.from("working_hours").insert(hours), db.from("services").insert(services)]);
  if (h.error || s.error) console.error("Falha ao criar dados iniciais", h.error ?? s.error);

  redirect("/painel");
}
