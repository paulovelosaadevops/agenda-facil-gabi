import type { SupabaseClient } from "@supabase/supabase-js";
import { dayBounds, findConflict, fitsWorkingHours, toDateKey } from "./availability.ts";
import { buildIcs, calendarUrl } from "./calendar.ts";
import { formatInTz, formatPhone, whatsappLink } from "./format.ts";
import { appointmentBlocks, appUrl, notifyClient, notifyOwner, whatsappAction } from "./notify.ts";
import { pushToOwner } from "./push.ts";
import { BookingError, getService, loadBusy, loadWorkingHours } from "./slots.ts";
import type { AppointmentSource, Business, Client } from "./types.ts";

export { BookingError, getAvailableSlots, getService } from "./slots.ts";

export async function findOrCreateClient(
  db: SupabaseClient,
  businessId: string,
  phone: string,
  name: string,
): Promise<Client> {
  const { data: existing, error } = await db
    .from("clients")
    .select("*")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data, error: insertError } = await db
    .from("clients")
    .insert({ business_id: businessId, phone, name: name.trim() || "Cliente" })
    .select()
    .single();
  if (insertError) throw insertError;
  return data;
}

/** Dados obrigatórios da cliente (regra do estúdio: todos sempre obrigatórios). */
export interface ClientProfile {
  name: string;
  phone: string; // só dígitos com DDI
  whatsapp: boolean;
  instagram: string;
  email: string;
}

/** Cadastra a cliente ou devolve a ficha que já existe com esse telefone (sem duplicar). */
export async function upsertClientProfile(db: SupabaseClient, businessId: string, profile: ClientProfile): Promise<Client> {
  const { data: existing, error } = await db
    .from("clients")
    .select("*")
    .eq("business_id", businessId)
    .eq("phone", profile.phone)
    .maybeSingle<Client>();
  if (error) throw error;
  if (existing) return existing;

  const { data, error: insertError } = await db
    .from("clients")
    .insert({ business_id: businessId, ...profile, name: profile.name.trim(), email: profile.email.trim().toLowerCase() })
    .select()
    .single();
  if (insertError) {
    if (insertError.code === "23505") throw new BookingError("Já existe uma cliente com esse e-mail.");
    throw insertError;
  }
  return data;
}

export interface CreateBookingInput {
  business: Business;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  source: AppointmentSource;
  notes?: string;
  /** Painel pode encaixar fora do expediente/antecedência; cliente e IA não. */
  enforceRules: boolean;
  /** Regra das clientes: no máximo 1 agendamento ativo por dia (combos cobrem mão + pé). */
  onePerDay?: boolean;
  notifyClient: boolean;
}

export async function createBooking(db: SupabaseClient, input: CreateBookingInput) {
  const { business } = input;
  const service = await getService(db, business.id, input.serviceId);
  if (!service.active && input.enforceRules) throw new BookingError("Este serviço não está disponível.");

  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

  if (input.enforceRules) {
    const now = Date.now();
    if (startsAt.getTime() < now + business.min_advance_hours * 3_600_000) {
      throw new BookingError(`Agendamentos precisam de pelo menos ${business.min_advance_hours}h de antecedência.`);
    }
    if (startsAt.getTime() > now + business.max_advance_days * 86_400_000) {
      throw new BookingError(`Só é possível agendar com até ${business.max_advance_days} dias de antecedência.`);
    }
    const workingHours = await loadWorkingHours(db, business.id);
    if (!fitsWorkingHours(startsAt, service.duration_min, business.timezone, workingHours, business.latest_end_time ?? undefined)) {
      throw new BookingError(
        business.latest_end_time
          ? `Esse horário está fora do expediente ou terminaria depois das ${business.latest_end_time.slice(0, 5)}.`
          : "Esse horário está fora do expediente.",
      );
    }
  }

  // Serviços de pés só para clientes que a Gabi liberou (o painel dela pode agendar qualquer serviço).
  if (service.feet && input.enforceRules) {
    const { data: who, error: whoError } = await db.from("clients").select("feet").eq("id", input.clientId).single();
    if (whoError) throw whoError;
    if (!who.feet) {
      throw new BookingError("Esse serviço é só para clientes que a Gabi já atende nos pés. Fale com ela pelo WhatsApp para liberar.");
    }
  }

  if (input.onePerDay) {
    const day = dayBounds(toDateKey(startsAt, business.timezone), business.timezone);
    const { count, error: countError } = await db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("client_id", input.clientId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", day.start.toISOString())
      .lt("starts_at", day.end.toISOString());
    if (countError) throw countError;
    if (count) {
      throw new BookingError("Você já tem um horário marcado neste dia. Para fazer mais de um serviço, escolha um combo.");
    }
  }

  // Confere conflitos já considerando o intervalo entre atendimentos (o banco garante de novo no insert).
  const bufferMs = (business.buffer_min ?? 0) * 60_000;
  const { busy, blocks } = await loadBusy(db, business.id, {
    start: new Date(startsAt.getTime() - 24 * 3_600_000),
    end: new Date(endsAt.getTime() + bufferMs),
  });
  if (findConflict(startsAt.getTime(), endsAt.getTime() - startsAt.getTime(), bufferMs, busy, blocks)) {
    throw new BookingError("Esse horário não está mais disponível. Escolha outro.");
  }

  const { data, error } = await db
    .from("appointments")
    .insert({
      business_id: business.id,
      client_id: input.clientId,
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
      source: input.source,
      price_cents: service.price_cents,
      notes: input.notes ?? "",
    })
    .select("*, clients(id, name, phone, whatsapp, email)")
    .single();

  if (error) {
    // 23P01 = violação da restrição de exclusão (horário sobreposto em corrida).
    if (error.code === "23P01") throw new BookingError("Esse horário não está mais disponível. Escolha outro.");
    throw error;
  }

  const when = formatInTz(startsAt, "EEEE, dd/MM 'às' HH:mm", business.timezone);
  const client = data.clients;
  // "Adicionar ao calendário" para a cliente e para a Gabi (links assinados + .ics anexado nos e-mails).
  const calendar = { cliente: await calendarUrl(data.id, "cliente"), gabi: await calendarUrl(data.id, "gabi") };
  const icsFor = (title: string, description: string) =>
    buildIcs({ uid: data.id, start: startsAt, end: endsAt, title, description, location: business.address });
  if (input.notifyClient && client) {
    const first = client.name.split(" ")[0];
    await notifyClient(db, business, client, {
      kind: "confirmation",
      whatsapp:
        `Olá, ${first}. Seu horário de *${service.name}* com ${business.name} está confirmado para ${when}.` +
        (business.address ? `\nEndereço: ${business.address}` : "") +
        `\n\nSe precisar remarcar, é só responder esta mensagem.`,
      email: {
        subject: `Horário confirmado: ${service.name}, ${when}`,
        preheader: `Te espero ${when}.`,
        title: "Tudo certo!",
        text: `Olá, ${first}! Seu horário está confirmado. Antes do atendimento você recebe um lembrete por e-mail.`,
        ...appointmentBlocks(business, { startsAt, serviceName: service.name, durationMin: service.duration_min, priceCents: service.price_cents }),
        action: { label: "Adicionar ao calendário", url: calendar.cliente },
        secondaryAction: whatsappAction(
          business,
          `Olá, Gabi! Aqui é a ${first}. Preciso remarcar meu horário de ${service.name} marcado para ${when}. Quais outros horários você tem?`,
          "Remarcar pelo WhatsApp",
        ),
        extraAction: appUrl("/entrar") ? { label: "Ver meu painel", url: appUrl("/entrar")! } : undefined,
        attachment: { name: "agendamento-gabi-marqui.ics", content: icsFor(`${service.name} · Gabi Marqui`, business.name) },
      },
    });
  }

  // A Gabi recebe um aviso de cada horário marcado pelas clientes.
  if (input.source === "public" && client) {
    const blocks = appointmentBlocks(business, { startsAt, serviceName: service.name, priceCents: service.price_cents }, "Novo agendamento");
    const details: [string, string][] = [["Cliente", client.name], ["Telefone", formatPhone(client.phone)]];
    if (client.email) details.push(["E-mail", client.email]);
    if (input.notes) details.push(["Observações", input.notes]);
    await notifyOwner(db, business, {
      subject: `Novo agendamento: ${client.name}, ${when}`,
      preheader: `${service.name} · ${when}`,
      title: "Novo agendamento",
      text: `*${client.name.split(" ")[0]}* marcou um horário pelo link.`,
      card: { ...blocks.card!, lines: [blocks.card!.lines[0], `${service.name} · ${client.name}`] },
      details,
      action: appUrl("/agenda") ? { label: "Abrir a agenda", url: appUrl("/agenda")! } : undefined,
      secondaryAction: {
        label: `Chamar ${client.name.split(" ")[0]} no WhatsApp`,
        url: whatsappLink(client.phone, `Olá, ${client.name.split(" ")[0]}! Aqui é a Gabi. Recebi seu agendamento de ${service.name} para ${when}. Está tudo certo, te espero!`),
      },
      extraAction: { label: "Adicionar ao calendário", url: calendar.gabi },
      attachment: { name: "atendimento.ics", content: icsFor(`${client.name} · ${service.name}`, `Telefone: ${formatPhone(client.phone)}`) },
    });
    // Notificação no celular da Gabi (app instalado), quando ela ativou.
    await pushToOwner(db, business.id, {
      title: `${client.name.split(" ")[0]} agendou ${service.name}`,
      body: when.charAt(0).toUpperCase() + when.slice(1),
      url: `/agenda/${data.id}`,
      tag: data.id,
    });
  }

  return { appointment: data, service, calendar };
}
