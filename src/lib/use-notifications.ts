import { useEffect } from "react";
import { supabase } from "./supabase";
import { invalidate, useQuery } from "./use-query";

export interface AppNotification {
  id: string;
  appointment_id: string | null;
  /** Destino ao tocar (ex.: agendamento novo da manutenção); senão abre o agendamento. */
  url: string | null;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

/**
 * Notificações da Gabi (agendamentos novos pelo link e retornos de manutenção). Fica ouvindo o banco em tempo real:
 * quando chega uma nova, atualiza o contador e recarrega as telas abertas (agenda, Início).
 */
export function useNotifications(businessId: string) {
  const query = useQuery(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, appointment_id, url, kind, title, body, created_at, read_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<AppNotification[]>();
    if (error) throw error;
    return data ?? [];
  }, [businessId]);

  useEffect(() => {
    // Nome único por tela: o sino e a lista escutam ao mesmo tempo (o Supabase reaproveita canais de mesmo nome).
    const channel = supabase
      .channel(`notificacoes-${businessId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `business_id=eq.${businessId}` }, () => invalidate())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId]);

  const unread = (query.data ?? []).filter((n) => !n.read_at).length;
  return { ...query, unread };
}

/** Marca todas como lidas (ao abrir a lista). */
export async function markAllRead(businessId: string) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("business_id", businessId).is("read_at", null);
  invalidate();
}

