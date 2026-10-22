// Lembretes de agendamento. Chamado de hora em hora pelo pg_cron (ver migração de agendamento).
// Autenticação: header "Authorization: Bearer CRON_SECRET".
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "../_shared/env.ts";
import { formatInTz } from "../_shared/format.ts";
import { adminClient, handler, HttpError, json } from "../_shared/http.ts";
import { appointmentBlocks, appUrl, notifyClient, whatsappAction } from "../_shared/notify.ts";
import { pushToOwner } from "../_shared/push.ts";
import type { Business, MaintenanceAlert } from "../_shared/types.ts";

Deno.serve(
  handler(async (req) => {
    if (req.headers.get("Authorization") !== `Bearer ${requireEnv("CRON_SECRET")}`) {
      throw new HttpError(401, "unauthorized");
    }

    const db = adminClient();
    const now = new Date();
    // Maior janela possível (168h); cada estúdio filtra pela própria configuração abaixo.
    const horizon = new Date(now.getTime() + 168 * 3_600_000);

    const { data: appts, error } = await db
      .from("appointments")
      .select("id, starts_at, client_id, businesses(*), clients(id, name, phone, whatsapp, email), services(name)")
      .in("status", ["pending", "confirmed"])
      .is("reminder_sent_at", null)
      .gt("starts_at", now.toISOString())
      .lte("starts_at", horizon.toISOString());
    if (error) throw error;

    let sent = 0;
    for (const a of appts ?? []) {
      const business = a.businesses as unknown as Business;
      const client = a.clients as unknown as { id: string; name: string; phone: string; whatsapp: boolean; email: string | null } | null;
      const service = a.services as unknown as { name: string } | null;
      const startsAt = new Date(a.starts_at);
      if (!client || startsAt.getTime() - now.getTime() > business.reminder_hours_before * 3_600_000) continue;

      // Marca antes de enviar para não duplicar se duas execuções se sobrepuserem.
      const { data: claimed } = await db
        .from("appointments")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", a.id)
        .is("reminder_sent_at", null)
        .select("id");
      if (!claimed?.length) continue;

      const when = formatInTz(startsAt, "EEEE, dd/MM 'às' HH:mm", business.timezone);
      const first = client.name.split(" ")[0];
      const serviceName = service?.name ?? "atendimento";
      const delivered = await notifyClient(db, business, client, {
        kind: "reminder",
        whatsapp:
          `Olá, ${first}. Passando para lembrar do seu horário de *${serviceName}* ${when}.` +
          `\n\nPosso confirmar sua presença? Se precisar remarcar, é só me avisar por aqui.`,
        email: {
          subject: `Lembrete: ${serviceName}, ${when}`,
          preheader: `Te espero ${when}.`,
          title: "Até breve!",
          text: `Olá, ${first}! Passando para lembrar do seu horário. Se precisar remarcar, me chama no WhatsApp.`,
          ...appointmentBlocks(business, { startsAt, serviceName }),
          secondaryAction: whatsappAction(
            business,
            `Olá, Gabi! Aqui é a ${first}. Confirmo minha presença no horário de ${serviceName} marcado para ${when}. Até lá!`,
            "Confirmar presença no WhatsApp",
          ),
          extraAction: appUrl("/entrar") ? { label: "Ver meu painel", url: appUrl("/entrar")! } : undefined,
        },
      });
      if (delivered) sent++;
      // Nenhum canal funcionou: libera para tentar de novo na próxima execução.
      else await db.from("appointments").update({ reminder_sent_at: null }).eq("id", a.id);
    }

    const maintenance = await notifyMaintenance(db, now);
    return json({ sent, maintenance });
  }),
);

/**
 * Manutenção: quando chega o dia do aviso (ex.: dia 20 de um retorno de 21 dias), manda
 * WhatsApp para a cliente com o link de agendamento. A Gabi vê os mesmos alertas na tela Início.
 */
async function notifyMaintenance(db: SupabaseClient, now: Date): Promise<number> {
  const { data: alerts, error } = await db
    .from("maintenance_alerts")
    .select("*")
    .lte("notify_at", now.toISOString())
    .returns<MaintenanceAlert[]>();
  if (error) throw error;
  if (!alerts?.length) return 0;

  const { data: already } = await db
    .from("maintenance_notifications")
    .select("appointment_id")
    .in("appointment_id", alerts.map((a) => a.appointment_id));
  const notified = new Set((already ?? []).map((n) => n.appointment_id));
  const businesses = new Map<string, Business>();

  let count = 0;
  for (const alert of alerts) {
    if (notified.has(alert.appointment_id)) continue;
    // Marca antes de enviar: nunca manda duas vezes, mesmo com execuções sobrepostas.
    const { error: claimError } = await db.from("maintenance_notifications").insert({ appointment_id: alert.appointment_id });
    if (claimError) continue;

    let business = businesses.get(alert.business_id);
    if (!business) {
      const { data } = await db.from("businesses").select("*").eq("id", alert.business_id).single<Business>();
      if (!data) continue;
      business = data;
      businesses.set(business.id, business);
    }

    const due = formatInTz(alert.due_at, "dd/MM", business.timezone);
    const first = alert.client_name.split(" ")[0];

    // A Gabi também é avisada (sino + celular), com o agendamento da manutenção já preenchido.
    const bookUrl = `/agenda/novo?cliente=${alert.client_id}&servico=${alert.return_service_id}`;
    await db.from("notifications").insert({
      business_id: business.id,
      kind: "maintenance",
      title: `${alert.client_name}: hora da manutenção`,
      body: `${alert.return_service_name} · ideal até ${due}`,
      url: bookUrl,
    });
    await pushToOwner(db, business.id, {
      title: `${first}: hora da manutenção`,
      body: `${alert.return_service_name} · ideal até ${due}. Toque para agendar.`,
      url: bookUrl,
      tag: `manutencao-${alert.appointment_id}`,
    });

    if (!alert.client_whatsapp && !alert.client_email) continue;
    const link = appUrl(`/agendar?servico=${alert.return_service_id}`);
    const delivered = await notifyClient(
      db,
      business,
      { id: alert.client_id, name: alert.client_name, phone: alert.client_phone, whatsapp: alert.client_whatsapp, email: alert.client_email },
      {
        kind: "reminder",
        whatsapp:
          `Olá, ${first}. Está chegando a hora da manutenção do seu ${alert.service_name.toLowerCase()} ` +
          `(o ideal é até ${due}). Quer reservar seu horário de *${alert.return_service_name}*?` +
          (link ? `\n\n${link}` : ""),
        email: {
          subject: `Hora da manutenção do seu ${alert.service_name.toLowerCase()}`,
          preheader: `O ideal é voltar até ${due}.`,
          title: "Hora da manutenção",
          text:
            `Olá, ${first}! Está chegando a hora da manutenção do seu ${alert.service_name.toLowerCase()}. ` +
            `O ideal é voltar até *${due}*. Que tal já reservar seu horário?`,
          details: [
            ["Último atendimento", formatInTz(alert.done_at, "dd/MM", business.timezone)],
            ["Retorno ideal até", due],
            ["Serviço", alert.return_service_name],
          ],
          action: link ? { label: "Agendar manutenção", url: link } : undefined,
          secondaryAction: whatsappAction(business, `Olá, Gabi! Aqui é a ${first}. Quero agendar a manutenção do meu ${alert.service_name.toLowerCase()}.`),
        },
      },
    );
    if (delivered) count++;
  }
  return count;
}
