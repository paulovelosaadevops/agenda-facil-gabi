// Conta de login da cliente, decidida no servidor (docs/mudanca-login.md, Etapa 1 e D8).
// Ninguém se cadastra sozinha: a conta nasce no primeiro agendamento (com os dados) ou no primeiro acesso de
// uma cliente que a Nail já cadastrou. O papel fica em app_metadata, que só o servidor consegue alterar.
// A senha é definida pela própria cliente depois do primeiro código (D8).
import type { SupabaseClient } from "@supabase/supabase-js";
import { BookingError } from "./slots.ts";
import type { Business, Client } from "./types.ts";

/** Dados obrigatórios de quem agenda pela primeira vez (o e-mail vem à parte). */
export interface NewClientData {
  name: string;
  phone: string; // só dígitos com DDI
  whatsapp: boolean;
  instagram: string;
}

export type EnsureResult =
  | { needsProfile: true }
  /** `hasPassword`: a conta já tem senha (D8) — o link pede a senha em vez de enviar o código. */
  | { needsProfile: false; userId: string; client: Client; hasPassword: boolean };

async function authUserByEmail(db: SupabaseClient, email: string): Promise<{ id: string; has_password: boolean } | null> {
  const { data, error } = await db.rpc("auth_user_by_email", { p_email: email });
  if (error) throw error;
  return (data as { id: string; has_password: boolean }[] | null)?.[0] ?? null;
}

async function setClientRole(db: SupabaseClient, userId: string) {
  const { error } = await db.auth.admin.updateUserById(userId, { app_metadata: { role: "client" } });
  if (error) throw error;
}

/** Ficha da cliente para este e-mail: a que já existe (pelo e-mail ou pelo telefone) ou uma nova. */
async function findOrCreateProfile(db: SupabaseClient, business: Business, email: string, data?: NewClientData): Promise<Client | null> {
  const { data: byEmail, error } = await db
    .from("clients")
    .select("*")
    .eq("business_id", business.id)
    .eq("email", email)
    .maybeSingle<Client>();
  if (error) throw error;
  if (byEmail) {
    if (byEmail.user_id) throw new BookingError("Este e-mail já está ligado a outra conta. Fale com a Gabi.");
    return byEmail; // cadastrada pela Nail (ou ficha sem conta): primeiro acesso
  }
  if (!data) return null;

  const { data: byPhone, error: phoneError } = await db
    .from("clients")
    .select("*")
    .eq("business_id", business.id)
    .eq("phone", data.phone)
    .maybeSingle<Client>();
  if (phoneError) throw phoneError;
  if (byPhone) {
    if (byPhone.user_id) throw new BookingError("Este telefone já está ligado a outra conta. Use o e-mail dessa conta ou fale com a Gabi.");
    // Só a Nail troca o e-mail de uma ficha (D5): ficha com outro e-mail não é assumida por aqui.
    if (byPhone.email && byPhone.email !== email) {
      throw new BookingError("Este telefone já está cadastrado com outro e-mail. Use o e-mail cadastrado ou fale com a Gabi.");
    }
    const { data: updated, error: updateError } = await db
      .from("clients")
      .update({ email, whatsapp: data.whatsapp, instagram: byPhone.instagram || data.instagram })
      .eq("id", byPhone.id)
      .select("*")
      .single<Client>();
    if (updateError) throw updateError;
    return updated;
  }

  const { data: created, error: insertError } = await db
    .from("clients")
    .insert({ business_id: business.id, ...data, name: data.name.trim(), email })
    .select("*")
    .single<Client>();
  if (insertError) throw insertError;
  return created;
}

/**
 * Garante que este e-mail tenha conta de cliente ligada a uma ficha, sem duplicar.
 * Sem ficha para o e-mail e sem `data`, devolve `needsProfile` (o front pede os dados obrigatórios).
 */
export async function ensureClientAccount(db: SupabaseClient, business: Business, rawEmail: string, data?: NewClientData): Promise<EnsureResult> {
  const email = rawEmail.trim().toLowerCase();
  const existing = await authUserByEmail(db, email);
  const existingUserId = existing?.id ?? null;
  const hasPassword = Boolean(existing?.has_password);
  if (existingUserId && existingUserId === business.owner_id) {
    throw new BookingError("Este e-mail é da conta do estúdio. Use outro e-mail para agendar.");
  }

  // Já é cliente com conta: nada a criar.
  if (existingUserId) {
    const { data: linked, error } = await db.from("clients").select("*").eq("user_id", existingUserId).maybeSingle<Client>();
    if (error) throw error;
    if (linked) {
      await setClientRole(db, existingUserId);
      return { needsProfile: false, userId: existingUserId, client: linked, hasPassword };
    }
  }

  const client = await findOrCreateProfile(db, business, email, data);
  if (!client) return { needsProfile: true };

  // Conta de login: a que já existe para o e-mail (ex.: ficha apagada) ou uma nova, criada pela API de admin.
  let userId = existingUserId;
  let created = false;
  if (!userId) {
    const { data: user, error } = await db.auth.admin.createUser({ email, email_confirm: true, app_metadata: { role: "client" } });
    if (error || !user.user) throw error ?? new Error("Não foi possível criar a conta.");
    userId = user.user.id;
    created = true;
  }

  const { data: linked, error: linkError } = await db
    .from("clients")
    .update({ user_id: userId })
    .eq("id", client.id)
    .is("user_id", null)
    .select("*")
    .maybeSingle<Client>();
  if (linkError || !linked) {
    // Não ligou (outra requisição ligou antes): desfaz a conta recém-criada para não sobrar conta solta.
    if (created) await db.auth.admin.deleteUser(userId);
    if (linkError) throw linkError;
    throw new BookingError("Não foi possível ligar sua conta. Tente de novo.");
  }
  if (!created) await setClientRole(db, userId);
  return { needsProfile: false, userId, client: linked, hasPassword };
}
