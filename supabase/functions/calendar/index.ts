// "Adicionar ao calendário": devolve o horário em .ics. Link público, mas assinado (ver _shared/calendar.ts).
// GET /functions/v1/calendar?a=<agendamento>&p=cliente|gabi&t=<assinatura>
import { buildIcs, calendarToken, type CalendarAudience } from "../_shared/calendar.ts";
import { formatPhone } from "../_shared/format.ts";
import { adminClient, handler, HttpError } from "../_shared/http.ts";

Deno.serve(
  handler(async (req) => {
    const url = new URL(req.url);
    const id = url.searchParams.get("a") ?? "";
    const audience = url.searchParams.get("p") as CalendarAudience;
    const token = url.searchParams.get("t") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(id) || !["cliente", "gabi"].includes(audience) || token !== (await calendarToken(id, audience))) {
      throw new HttpError(404, "Agendamento não encontrado.");
    }

    const { data: a } = await adminClient()
      .from("appointments")
      .select("id, starts_at, ends_at, status, notes, businesses(name, address, phone), clients(name, phone), services(name)")
      .eq("id", id)
      .maybeSingle();
    if (!a) throw new HttpError(404, "Agendamento não encontrado.");
    const business = a.businesses as unknown as { name: string; address: string | null; phone: string | null };
    const client = a.clients as unknown as { name: string; phone: string } | null;
    const service = (a.services as unknown as { name: string } | null)?.name ?? "Atendimento";

    // A cliente vê "Manicure · Gabi Marqui"; a Gabi vê "Júlia Castro · Manicure" com o telefone.
    const forGabi = audience === "gabi";
    const ics = buildIcs({
      uid: `${a.id}-${audience}`,
      start: new Date(a.starts_at),
      end: new Date(a.ends_at),
      title: forGabi ? `${client?.name ?? "Cliente"} · ${service}` : `${service} · Gabi Marqui`,
      description: forGabi
        ? [client ? `Telefone: ${formatPhone(client.phone)}` : "", a.notes ? `Observações: ${a.notes}` : ""].filter(Boolean).join("\n")
        : [business.name, business.phone ? `WhatsApp: ${formatPhone(business.phone)}` : ""].filter(Boolean).join("\n"),
      location: business.address,
      cancelled: a.status === "cancelled",
    });

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${forGabi ? "atendimento" : "agendamento-gabi-marqui"}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  }),
);
