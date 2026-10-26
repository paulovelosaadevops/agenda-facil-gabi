// Integração contra um Supabase LOCAL VAZIO: os testes criam o estúdio e se recusam a rodar se já existir um.
// Rode com: npm run db:start && npm run test:integration (SUPABASE_SERVICE_ROLE_KEY em .env.integration.local)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "date-fns";
import { beforeAll, describe, expect, it } from "vitest";
import { toDateKey } from "./availability.ts";
import { BookingError, createBooking, getAvailableSlots, upsertClientProfile } from "./booking.ts";
import { formatInTz } from "./format.ts";
import type { Business, Client } from "./types.ts";

const run = process.env.SUPABASE_INTEGRATION === "1";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "senha-segura-123";

function anon() {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function signUp(meta?: Record<string, unknown>): Promise<SupabaseClient> {
  const db = anon();
  const { error } = await db.auth.signUp({ email: `t-${crypto.randomUUID()}@example.com`, password: PASSWORD, options: { data: meta } });
  if (error) throw error;
  return db;
}

const profile = (phone: string, name = "Cliente Teste") => ({ name, phone, whatsapp: true, instagram: "@teste", email: `${phone}@example.com` });

describe.runIf(run)("regras do estúdio com banco real", () => {
  let owner: SupabaseClient;
  let admin: SupabaseClient;
  let business: Business;
  let serviceId: string;
  let date: string;
  const local = (d: Date) => formatInTz(d, "HH:mm", business.timezone);

  beforeAll(async () => {
    if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Testes de integração só rodam contra o Supabase local.");
    // Links do calendário (createBooking) precisam do endereço e do segredo, como nas funções.
    process.env.SUPABASE_URL ??= url;
    process.env.CRON_SECRET ??= "segredo-de-teste";
    admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    // Estúdio único: nunca apaga dados. Com o estúdio real cadastrado, use outro banco (npx supabase db reset em um clone).
    const { count } = await admin.from("businesses").select("id", { count: "exact", head: true });
    if (count) throw new Error("Já existe um estúdio neste banco. Os testes de integração só rodam em um banco vazio.");

    owner = await signUp();
    const { data: user } = await owner.auth.getUser();
    const { data, error } = await owner
      .from("businesses")
      .insert({ owner_id: user.user!.id, name: "Studio Teste", slug: `teste-${Date.now()}`, min_advance_hours: 0 })
      .select()
      .single();
    if (error) throw error;
    business = data;

    const { data: service, error: sErr } = await owner
      .from("services")
      .insert({ business_id: business.id, name: "Gel", duration_min: 60, price_cents: 9000, maintenance_days: 21, maintenance_notice_days: 1 })
      .select("id")
      .single();
    if (sErr) throw sErr;
    serviceId = service.id;

    // Todos os dias 09–12 para não depender do dia da semana.
    const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ business_id: business.id, weekday, start_time: "09:00", end_time: "12:00" }));
    const { error: hErr } = await owner.from("working_hours").insert(hours);
    if (hErr) throw hErr;

    date = toDateKey(addDays(new Date(), 3), business.timezone);
  });

  it("só existe um estúdio: outra conta não consegue criar outro", async () => {
    const other = await signUp();
    const { data: user } = await other.auth.getUser();
    const { error } = await other.from("businesses").insert({ owner_id: user.user!.id, name: "Outro", slug: `outro-${Date.now()}` });
    expect(error).not.toBeNull();
  });

  it("RLS: conta sem vínculo não enxerga nem altera os dados do estúdio", async () => {
    const intruder = await signUp();
    expect((await intruder.from("businesses").select("id")).data).toEqual([]);
    expect((await intruder.from("clients").select("id")).data).toEqual([]);
    const { error } = await intruder.from("services").insert({ business_id: business.id, name: "Invasão", duration_min: 30 });
    expect(error).not.toBeNull();
  });

  it("intervalo de 30 min: agendamento às 09:00 (1h) libera o próximo às 10:30", async () => {
    const before = (await getAvailableSlots(admin, business, serviceId, date)).map(local);
    // Grade 09:00–12:00 (último início 11:30): com o limite de término (20:30), o atendimento pode passar das 12:00.
    expect(before).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);

    const client = await upsertClientProfile(admin, business.id, profile("5511988887777", "Ana"));
    const nine = (await getAvailableSlots(admin, business, serviceId, date))[0];
    await createBooking(admin, { business, serviceId, clientId: client.id, startsAt: nine, source: "panel", enforceRules: false, notifyClient: true });

    const after = (await getAvailableSlots(admin, business, serviceId, date)).map(local);
    expect(after).toEqual(["10:30", "11:00", "11:30"]);

    // O banco recusa invadir o intervalo mesmo sem passar pelas regras do app.
    const { error } = await admin.from("appointments").insert({
      business_id: business.id,
      client_id: client.id,
      service_id: serviceId,
      starts_at: new Date(nine.getTime() + 75 * 60_000).toISOString(), // 10:15
      ends_at: new Date(nine.getTime() + 135 * 60_000).toISOString(),
    });
    expect(error?.code).toBe("23P01");

    const { data: msgs } = await admin.from("messages").select("kind, body").eq("business_id", business.id);
    expect(msgs?.some((m) => m.kind === "confirmation" && m.body.includes("Gel"))).toBe(true);
  });

  it("duas reservas simultâneas no mesmo horário: só uma passa", async () => {
    const [slot] = await getAvailableSlots(admin, business, serviceId, date);
    const a = await upsertClientProfile(admin, business.id, profile("5511911111111", "Bia"));
    const b = await upsertClientProfile(admin, business.id, profile("5511922222222", "Carla"));
    const attempt = (clientId: string) =>
      createBooking(admin, { business, serviceId, clientId, startsAt: slot, source: "public", enforceRules: true, notifyClient: false });
    const results = await Promise.allSettled([attempt(a.id), attempt(b.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(BookingError);
  });

  it("conta de cliente: assume a ficha que a Gabi já criou (sem duplicar) e só vê os próprios horários", async () => {
    const clientDb = await signUp({ role: "client", name: "Ana Souza", phone: "5511988887777", whatsapp: true, instagram: "@ana" });
    const { data: mine } = await clientDb.from("clients").select("*").returns<Client[]>();
    expect(mine).toHaveLength(1);
    expect(mine![0].name).toBe("Ana"); // manteve a ficha existente
    expect(mine![0].user_id).not.toBeNull();

    const { count } = await admin.from("clients").select("id", { count: "exact", head: true }).eq("phone", "5511988887777");
    expect(count).toBe(1);

    const { data: appts } = await clientDb.from("appointments").select("client_id");
    expect(appts!.length).toBeGreaterThan(0);
    expect(appts!.every((a) => a.client_id === mine![0].id)).toBe(true);
  });

  it("mesmo telefone em outra conta é recusado", async () => {
    const db = anon();
    const { error } = await db.auth.signUp({
      email: `t-${crypto.randomUUID()}@example.com`,
      password: PASSWORD,
      options: { data: { role: "client", name: "Outra", phone: "5511988887777", whatsapp: true, instagram: "@x" } },
    });
    expect(error).not.toBeNull();
  });

  it("cliente: no máximo 1 agendamento por dia", async () => {
    const day = toDateKey(addDays(new Date(), 5), business.timezone);
    const client = await upsertClientProfile(admin, business.id, profile("5511933333333", "Duda"));
    const [first, , , second] = await getAvailableSlots(admin, business, serviceId, day);
    const book = (startsAt: Date) =>
      createBooking(admin, { business, serviceId, clientId: client.id, startsAt, source: "public", enforceRules: true, onePerDay: true, notifyClient: false });
    await book(first);
    await expect(book(second)).rejects.toThrow(/já tem um horário marcado neste dia/);
  });

  it("manutenção: atendimento há 20 dias com retorno em 21 gera alerta para a Gabi e para a cliente", async () => {
    const clientDb = await signUp({ role: "client", name: "Eva Lima", phone: "5511944444444", whatsapp: true, instagram: "@eva" });
    const { data: eva } = await clientDb.from("clients").select("id").single();
    const doneAt = addDays(new Date(), -20);
    await admin.from("appointments").insert({
      business_id: business.id,
      client_id: eva!.id,
      service_id: serviceId,
      starts_at: doneAt.toISOString(),
      ends_at: new Date(doneAt.getTime() + 3_600_000).toISOString(),
      status: "completed",
    });

    const { data: forOwner } = await owner.from("maintenance_alerts").select("*").eq("client_id", eva!.id).lte("notify_at", new Date().toISOString());
    expect(forOwner).toHaveLength(1);
    const { data: forClient } = await clientDb.from("maintenance_alerts").select("*");
    expect(forClient).toHaveLength(1);
  });

  it("serviço de pés: só para clientes liberadas, e a cliente não consegue se liberar sozinha", async () => {
    const { data: feetService, error: fErr } = await owner
      .from("services")
      .insert({ business_id: business.id, name: "Pedicure", duration_min: 30, price_cents: 5000, feet: true })
      .select("id")
      .single();
    if (fErr) throw fErr;
    const clientDb = await signUp({ role: "client", name: "Lia Prado", phone: "5511955555555", whatsapp: true, instagram: "@lia" });
    const { data: lia } = await clientDb.from("clients").select("id, feet").single();
    expect(lia!.feet).toBe(false);

    const day = toDateKey(addDays(new Date(), 7), business.timezone);
    const [slot] = await getAvailableSlots(admin, business, feetService.id, day);
    const book = () =>
      createBooking(admin, { business, serviceId: feetService.id, clientId: lia!.id, startsAt: slot, source: "public", enforceRules: true, notifyClient: false });
    await expect(book()).rejects.toThrow(/só para clientes que a Gabi já atende nos pés/);

    // A cliente tenta se liberar pelo próprio perfil: o banco ignora.
    await clientDb.from("clients").update({ feet: true }).eq("id", lia!.id);
    expect((await admin.from("clients").select("feet").eq("id", lia!.id).single()).data!.feet).toBe(false);

    // A Gabi libera: agora agenda.
    await owner.from("clients").update({ feet: true }).eq("id", lia!.id);
    await expect(book()).resolves.toBeTruthy();
  });

  it("cancelar libera o horário de novo", async () => {
    const before = (await getAvailableSlots(admin, business, serviceId, date)).length;
    const { data: appts } = await admin.from("appointments").select("id").eq("business_id", business.id).in("status", ["pending", "confirmed"]).gte("starts_at", new Date().toISOString());
    for (const a of appts ?? []) await owner.from("appointments").update({ status: "cancelled" }).eq("id", a.id);
    const after = (await getAvailableSlots(admin, business, serviceId, date)).length;
    expect(after).toBeGreaterThan(before);
  });
});
