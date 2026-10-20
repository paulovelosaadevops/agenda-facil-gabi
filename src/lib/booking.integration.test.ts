// Integração contra o Supabase local. Rode com: npm run db:start && npm run test:integration
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "date-fns";
import { beforeAll, describe, expect, it } from "vitest";
import { toDateKey } from "./availability";
import { BookingError, createBooking, findOrCreateClient, getAvailableSlots } from "./booking";
import type { Business } from "./types";

const run = process.env.SUPABASE_INTEGRATION === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function newUser(): Promise<SupabaseClient> {
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const email = `test-${crypto.randomUUID()}@example.com`;
  const { error } = await db.auth.signUp({ email, password: "senha-segura-123" });
  if (error) throw error;
  return db;
}

describe.runIf(run)("agendamento com banco real", () => {
  let owner: SupabaseClient;
  let admin: SupabaseClient;
  let business: Business;
  let serviceId: string;
  let date: string;

  beforeAll(async () => {
    owner = await newUser();
    admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: user } = await owner.auth.getUser();

    const slug = `teste-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await owner
      .from("businesses")
      .insert({ owner_id: user.user!.id, name: "Studio Teste", slug, min_advance_hours: 0 })
      .select()
      .single();
    if (error) throw error;
    business = data;

    const { data: service, error: sErr } = await owner
      .from("services")
      .insert({ business_id: business.id, name: "Gel", duration_min: 60, price_cents: 9000 })
      .select("id")
      .single();
    if (sErr) throw sErr;
    serviceId = service.id;

    // Abre todos os dias 09-12 para o teste não depender do dia da semana.
    const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      business_id: business.id,
      weekday,
      start_time: "09:00",
      end_time: "12:00",
    }));
    const { error: hErr } = await owner.from("working_hours").insert(hours);
    if (hErr) throw hErr;

    date = toDateKey(addDays(new Date(), 3), business.timezone);
  });

  it("RLS: outra conta não enxerga nem altera os dados do estúdio", async () => {
    const intruder = await newUser();
    const { data: seen } = await intruder.from("businesses").select("id").eq("id", business.id);
    expect(seen).toEqual([]);
    const { data: services } = await intruder.from("services").select("id").eq("business_id", business.id);
    expect(services).toEqual([]);
    const { error } = await intruder
      .from("services")
      .insert({ business_id: business.id, name: "Invasão", duration_min: 30 });
    expect(error).not.toBeNull();
  });

  it("lista horários livres e remove o que for agendado", async () => {
    const before = await getAvailableSlots(admin, business, serviceId, date);
    expect(before.length).toBe(5); // 09:00, 09:30, 10:00, 10:30, 11:00

    const client = await findOrCreateClient(admin, business.id, "5511988887777", "Ana");
    await createBooking(admin, {
      business,
      serviceId,
      clientId: client.id,
      startsAt: before[2], // 10:00
      source: "public",
      enforceRules: true,
      notifyClient: true,
    });

    const after = await getAvailableSlots(admin, business, serviceId, date);
    // 10:00-11:00 ocupado: saem 09:30, 10:00 e 10:30 (se sobrepõem).
    expect(after.map((d) => d.toISOString())).toEqual([before[0], before[4]].map((d) => d.toISOString()));

    const { data: msgs } = await admin.from("messages").select("kind, body").eq("business_id", business.id);
    expect(msgs?.some((m) => m.kind === "confirmation" && m.body.includes("Gel"))).toBe(true);
  });

  it("recusa horário fora do expediente quando as regras valem", async () => {
    const client = await findOrCreateClient(admin, business.id, "5511988887777", "Ana");
    const slots = await getAvailableSlots(admin, business, serviceId, date);
    const late = new Date(slots[0].getTime() + 10 * 3_600_000); // 19:00
    await expect(
      createBooking(admin, { business, serviceId, clientId: client.id, startsAt: late, source: "whatsapp", enforceRules: true, notifyClient: false }),
    ).rejects.toThrow(BookingError);
  });

  it("duas reservas simultâneas no mesmo horário: só uma passa", async () => {
    const [slot] = await getAvailableSlots(admin, business, serviceId, date);
    const a = await findOrCreateClient(admin, business.id, "5511911111111", "Bia");
    const b = await findOrCreateClient(admin, business.id, "5511922222222", "Carla");
    const attempt = (clientId: string) =>
      createBooking(admin, { business, serviceId, clientId, startsAt: slot, source: "public", enforceRules: true, notifyClient: false });

    const results = await Promise.allSettled([attempt(a.id), attempt(b.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BookingError);
  });

  it("cancelar libera o horário de novo", async () => {
    const { data: appts } = await admin
      .from("appointments")
      .select("id, starts_at")
      .eq("business_id", business.id)
      .eq("status", "confirmed");
    const before = (await getAvailableSlots(admin, business, serviceId, date)).length;
    await owner.from("appointments").update({ status: "cancelled" }).eq("id", appts![0].id);
    const after = (await getAvailableSlots(admin, business, serviceId, date)).length;
    expect(after).toBeGreaterThan(before);
  });
});
