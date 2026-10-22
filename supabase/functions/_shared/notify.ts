// Avisos para a cliente (e-mail + WhatsApp quando houver provedor) e para a Gabi (e-mail).
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type Email } from "./email.ts";
import { getEnv } from "./env.ts";
import { formatDuration, formatInTz, formatMoney, whatsappLink } from "./format.ts";
import { sendMessage } from "./messaging/index.ts";
import type { Business } from "./types.ts";

export interface NotifyTarget {
  id: string;
  name: string;
  phone: string;
  whatsapp: boolean;
  email: string | null;
}

export interface Notice {
  kind: "confirmation" | "reminder";
  /** Texto do WhatsApp (*negrito* no estilo do WhatsApp). */
  whatsapp: string;
  email: Omit<Email, "to">;
}

/** Manda o aviso por todos os canais da cliente. Falha em um canal não impede o outro. */
export async function notifyClient(db: SupabaseClient, business: Business, client: NotifyTarget, notice: Notice): Promise<boolean> {
  let delivered = false;
  if (client.email) {
    try {
      const id = await sendEmail({ ...notice.email, to: { email: client.email, name: client.name } });
      await db.from("messages").insert({
        business_id: business.id,
        client_id: client.id,
        phone: client.phone,
        direction: "out",
        body: `${notice.email.subject}\n\n${notice.email.text}`,
        kind: notice.kind,
        provider: "email",
        provider_message_id: id ?? null,
      });
      delivered = true;
    } catch (err) {
      console.error("Falha ao enviar e-mail", client.id, err);
    }
  }
  if (client.whatsapp) {
    try {
      await sendMessage(db, { business, phone: client.phone, clientId: client.id, kind: notice.kind, body: notice.whatsapp });
      delivered = true;
    } catch (err) {
      console.error("Falha ao enviar WhatsApp", client.id, err);
    }
  }
  return delivered;
}

/** E-mail para a Gabi (dona do estúdio). Usa NOTIFY_OWNER_EMAIL ou o e-mail da conta dela. */
export async function notifyOwner(db: SupabaseClient, business: Business, email: Omit<Email, "to">) {
  try {
    let to = getEnv("NOTIFY_OWNER_EMAIL");
    if (!to) {
      const { data } = await db.auth.admin.getUserById(business.owner_id);
      to = data.user?.email;
    }
    if (to) await sendEmail({ ...email, to: { email: to, name: business.name } });
  } catch (err) {
    console.error("Falha ao avisar a dona do estúdio", err);
  }
}

/** Link do app publicado (ex.: https://agenda-facil-gabi.expo.app). */
export const appUrl = (path = "") => {
  const base = getEnv("APP_URL")?.replace(/\/$/, "");
  return base ? `${base}${path}` : undefined;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Botão "Falar com a Gabi no WhatsApp", que abre a conversa com a mensagem já escrita. */
export function whatsappAction(business: Business, message: string, label = "Falar com a Gabi no WhatsApp"): Email["secondaryAction"] {
  return business.phone ? { label, url: whatsappLink(business.phone, message) } : undefined;
}

/** Cartão "SEU HORÁRIO" + detalhes, iguais aos da tela de confirmação do app. */
export function appointmentBlocks(
  business: Business,
  appt: { startsAt: Date; serviceName: string; durationMin?: number; priceCents?: number },
  overline = "Seu horário",
): Pick<Email, "card" | "details"> {
  const tz = business.timezone;
  const details: [string, string][] = [["Serviço", appt.serviceName]];
  if (appt.durationMin) details.push(["Duração", formatDuration(appt.durationMin)]);
  if (appt.priceCents != null) details.push(["Valor", formatMoney(appt.priceCents)]);
  if (business.address) details.push(["Endereço", business.address]);
  return {
    card: {
      overline,
      highlight: formatInTz(appt.startsAt, "HH:mm", tz),
      lines: [capitalize(formatInTz(appt.startsAt, "EEEE, d 'de' MMMM", tz)), appt.serviceName],
    },
    details,
  };
}

