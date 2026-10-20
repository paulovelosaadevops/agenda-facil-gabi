"use server";

import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseDateKey } from "@/lib/availability";
import { requireBusiness } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

export type SettingsState = { error?: string; ok?: boolean } | undefined;

const StudioSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do estúdio."),
  phone: z.string().optional(),
  address: z.string().trim().optional(),
});

const SchedulingSchema = z.object({
  slot_interval_min: z.coerce.number().int().min(5).max(120),
  min_advance_hours: z.coerce.number().int().min(0).max(168),
  max_advance_days: z.coerce.number().int().min(1).max(365),
  reminder_hours_before: z.coerce.number().int().min(1).max(168),
});

const AiSchema = z.object({ ai_instructions: z.string().max(4000).default("") });

async function updateBusiness(patch: Record<string, unknown>): Promise<SettingsState> {
  const { db, business } = await requireBusiness();
  const { error } = await db.from("businesses").update(patch).eq("id", business.id);
  if (error) return { error: error.message };
  revalidatePath("/painel", "layout");
  return { ok: true };
}

export async function saveStudio(_: SettingsState, form: FormData): Promise<SettingsState> {
  const parsed = StudioSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return { error: "WhatsApp inválido. Use DDD + número." };
  return updateBusiness({ name: parsed.data.name, phone, address: parsed.data.address || null });
}

export async function saveScheduling(_: SettingsState, form: FormData): Promise<SettingsState> {
  const parsed = SchedulingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return updateBusiness(parsed.data);
}

export async function saveAi(_: SettingsState, form: FormData): Promise<SettingsState> {
  const parsed = AiSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return updateBusiness({ ...parsed.data, ai_enabled: form.get("ai_enabled") === "on" });
}

const TIME = /^\d{2}:\d{2}$/;

export async function saveWorkingHours(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { db, business } = await requireBusiness();
  const rows: { business_id: string; weekday: number; start_time: string; end_time: string }[] = [];

  for (let weekday = 0; weekday < 7; weekday++) {
    if (form.get(`open_${weekday}`) !== "on") continue;
    for (const slot of [1, 2]) {
      const start = String(form.get(`start${slot}_${weekday}`) ?? "");
      const end = String(form.get(`end${slot}_${weekday}`) ?? "");
      if (!start && !end) continue;
      if (!TIME.test(start) || !TIME.test(end) || end <= start) {
        return { error: "Confira os horários: o fim de cada período precisa ser depois do início." };
      }
      rows.push({ business_id: business.id, weekday, start_time: start, end_time: end });
    }
  }

  const { error: delError } = await db.from("working_hours").delete().eq("business_id", business.id);
  if (delError) return { error: delError.message };
  if (rows.length) {
    const { error } = await db.from("working_hours").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath("/painel", "layout");
  return { ok: true };
}

const TimeOffSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data inicial."),
  start_time: z.string().default(""),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data final."),
  end_time: z.string().default(""),
  reason: z.string().trim().default(""),
});

export async function addTimeOff(_: SettingsState, form: FormData): Promise<SettingsState> {
  const parsed = TimeOffSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { db, business } = await requireBusiness();
  const tzName = business.timezone;
  const toInstant = (date: string, time: string, dayOffset = 0) => {
    const [y, m, d] = parseDateKey(date);
    const [hh, mm] = TIME.test(time) ? time.split(":").map(Number) : [0, 0];
    return new Date(new TZDate(y, m - 1, d + dayOffset, hh, mm, 0, tzName).getTime());
  };

  const { start_date, start_time, end_date, end_time, reason } = parsed.data;
  const startsAt = toInstant(start_date, start_time);
  // Sem hora final: bloqueia até o fim do dia final.
  const endsAt = TIME.test(end_time) ? toInstant(end_date, end_time) : toInstant(end_date, "", 1);
  if (endsAt <= startsAt) return { error: "O fim do bloqueio precisa ser depois do início." };

  const { error } = await db.from("time_off").insert({
    business_id: business.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason,
  });
  if (error) return { error: error.message };
  revalidatePath("/painel", "layout");
  return { ok: true };
}

export async function deleteTimeOff(id: string) {
  const { db, business } = await requireBusiness();
  await db.from("time_off").delete().eq("id", id).eq("business_id", business.id);
  revalidatePath("/painel", "layout");
}
