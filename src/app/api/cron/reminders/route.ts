import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { formatInTz } from "@/lib/format";
import { sendMessage } from "@/lib/messaging";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

export const maxDuration = 60;

/**
 * Envia lembretes de agendamentos. Rode a cada hora (vercel.json já agenda).
 * Autenticação: header "Authorization: Bearer CRON_SECRET" (padrão da Vercel Cron).
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdmin();
  const now = new Date();
  // Maior janela possível (168h); cada negócio filtra pela própria configuração abaixo.
  const horizon = new Date(now.getTime() + 168 * 3_600_000);

  const { data: appts, error } = await db
    .from("appointments")
    .select("id, starts_at, client_id, businesses(*), clients(name, phone), services(name)")
    .in("status", ["pending", "confirmed"])
    .is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const a of appts ?? []) {
    const business = a.businesses as unknown as Business;
    const client = a.clients as unknown as { name: string; phone: string } | null;
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
    try {
      await sendMessage(db, {
        business,
        phone: client.phone,
        clientId: a.client_id,
        kind: "reminder",
        body:
          `Oi, ${client.name.split(" ")[0]}! 💅 Passando para lembrar do seu horário de *${service?.name ?? "atendimento"}* ` +
          `${when}.\n\nPosso confirmar sua presença? Se precisar remarcar, é só me avisar por aqui.`,
      });
      sent++;
    } catch (err) {
      console.error("Falha ao enviar lembrete", a.id, err);
      await db.from("appointments").update({ reminder_sent_at: null }).eq("id", a.id);
    }
  }

  return NextResponse.json({ sent });
}
